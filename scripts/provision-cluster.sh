#!/usr/bin/env bash
# =============================================================================
# provision-cluster.sh
# Production-ready provisioning script for a distributed ZooKeeper + Solr
# cluster on OVHcloud Ubuntu VMs.
#
# Usage:
#   chmod +x provision-cluster.sh
#   ./provision-cluster.sh
#
# Requirements (control machine):
#   - bash >= 4.0
#   - ssh, scp, ssh-keyscan in PATH
#   - Passwordless SSH access to all nodes
# =============================================================================

set -euo pipefail

# =============================================================================
# CONFIGURATION — edit these values before running
# =============================================================================

# Number of nodes (IPs: BASE_IP.1 … BASE_IP.NODE_COUNT)
readonly NODE_COUNT=11
readonly BASE_IP="10.1.16"

# SSH settings
readonly SSH_USER="ubuntu"
readonly SSH_KEY="${HOME}/.ssh/id_rsa"
readonly SSH_OPTS="-o StrictHostKeyChecking=no -o ConnectTimeout=10 -i ${SSH_KEY}"

# Software versions
readonly JAVA_PACKAGE="openjdk-17-jdk-headless"
readonly ZOOKEEPER_VERSION="3.9.2"
readonly SOLR_VERSION="9.6.0"

# Installation directories on remote nodes
readonly INSTALL_DIR="/opt"
readonly ZK_DIR="${INSTALL_DIR}/zookeeper"
readonly SOLR_DIR="${INSTALL_DIR}/solr"
readonly DATA_DIR="/var/data"

# Download mirrors (change if slow from your region)
readonly ZK_MIRROR="https://downloads.apache.org/zookeeper"
readonly SOLR_MIRROR="https://downloads.apache.org/solr/solr"

# Logging
readonly LOG_DIR="/tmp/provision-logs"
readonly TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
readonly MAIN_LOG="${LOG_DIR}/provision_${TIMESTAMP}.log"

# Concurrency: max parallel SSH sessions
readonly MAX_PARALLEL=5

# Retry settings
readonly MAX_RETRIES=3
readonly RETRY_DELAY=15   # seconds between retries

# =============================================================================
# INTERNAL — do not modify below unless you know what you are doing
# =============================================================================

# Build the list of node IPs
declare -a NODES=()
for i in $(seq 1 "${NODE_COUNT}"); do
  NODES+=("${BASE_IP}.${i}")
done

# Track failed nodes
declare -a FAILED_NODES=()

# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

# log <level> <message>
log() {
  local level="$1"
  shift
  local msg="$*"
  local ts
  ts="$(date '+%Y-%m-%d %H:%M:%S')"
  printf '[%s] [%-5s] %s\n' "${ts}" "${level}" "${msg}" | tee -a "${MAIN_LOG}"
}

log_node() {
  local node="$1"
  shift
  log "INFO" "[${node}] $*"
}

# ssh_exec <node> <command>
# Executes a remote command; output is logged to the node's own log file.
ssh_exec() {
  local node="$1"
  local cmd="$2"
  local node_log="${LOG_DIR}/node_${node}.log"

  # shellcheck disable=SC2029
  ssh ${SSH_OPTS} "${SSH_USER}@${node}" "${cmd}" \
    >>"${node_log}" 2>&1
}

# run_with_retry <node> <command> [description]
run_with_retry() {
  local node="$1"
  local cmd="$2"
  local desc="${3:-command}"
  local attempt=1

  while (( attempt <= MAX_RETRIES )); do
    log_node "${node}" "Attempt ${attempt}/${MAX_RETRIES}: ${desc}"
    if ssh_exec "${node}" "${cmd}"; then
      return 0
    fi
    log_node "${node}" "Attempt ${attempt} failed for: ${desc}"
    (( attempt++ ))
    sleep "${RETRY_DELAY}"
  done

  log "ERROR" "[${node}] All ${MAX_RETRIES} attempts failed: ${desc}"
  return 1
}

# =============================================================================
# INSTALLATION FUNCTIONS
# =============================================================================

# install_java <node>
install_java() {
  local node="$1"
  log_node "${node}" "Installing Java (${JAVA_PACKAGE})"

  run_with_retry "${node}" \
    "export DEBIAN_FRONTEND=noninteractive; \
     if java -version 2>/dev/null | grep -q 'openjdk'; then \
       echo 'Java already installed — skipping.'; \
     else \
       apt-get update -qq && \
       apt-get install -y -qq ${JAVA_PACKAGE} && \
       java -version; \
     fi" \
    "install Java"
}

# install_zookeeper <node> <zk_id>
# zk_id: integer 1..NODE_COUNT used as the ZooKeeper myid
install_zookeeper() {
  local node="$1"
  local zk_id="$2"
  log_node "${node}" "Installing ZooKeeper ${ZOOKEEPER_VERSION} (myid=${zk_id})"

  # Build the server list for zoo.cfg (all nodes)
  local server_entries=""
  for i in $(seq 1 "${NODE_COUNT}"); do
    server_entries+="server.${i}=${BASE_IP}.${i}:2888:3888\\n"
  done

  run_with_retry "${node}" \
    "set -euo pipefail
     ZK_HOME='${ZK_DIR}'
     ZK_VERSION='${ZOOKEEPER_VERSION}'
     ZK_DATA='${DATA_DIR}/zookeeper'
     ZK_TARBALL=\"apache-zookeeper-\${ZK_VERSION}-bin.tar.gz\"
     ZK_URL='${ZK_MIRROR}/\${ZK_VERSION}/\${ZK_TARBALL}'

     # Idempotency check
     if [[ -f \"\${ZK_HOME}/bin/zkServer.sh\" ]]; then
       echo 'ZooKeeper already installed — skipping download.'
     else
       mkdir -p '${INSTALL_DIR}'
       wget -q -O \"/tmp/\${ZK_TARBALL}\" \"\${ZK_URL}\"
       tar -xzf \"/tmp/\${ZK_TARBALL}\" -C '${INSTALL_DIR}'
       mv '${INSTALL_DIR}/apache-zookeeper-${ZOOKEEPER_VERSION}-bin' \"\${ZK_HOME}\"
       rm -f \"/tmp/\${ZK_TARBALL}\"
     fi

     # Data & log directories
     mkdir -p \"\${ZK_DATA}\" '${DATA_DIR}/zookeeper-logs'
     echo '${zk_id}' > \"\${ZK_DATA}/myid\"

     # zoo.cfg — variables expanded by the local shell before SSH transmission
     cat > \"\${ZK_HOME}/conf/zoo.cfg\" <<ZKCFG
tickTime=2000
initLimit=10
syncLimit=5
dataDir=${DATA_DIR}/zookeeper
dataLogDir=${DATA_DIR}/zookeeper-logs
clientPort=2181
maxClientCnxns=60
autopurge.snapRetainCount=3
autopurge.purgeInterval=1
$(printf '%b' "${server_entries}")
ZKCFG

     # Systemd service — paths already resolved to literals
     cat > /etc/systemd/system/zookeeper.service <<SVCEOF
[Unit]
Description=Apache ZooKeeper
After=network.target

[Service]
Type=forking
User=root
Environment=JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
ExecStart=${ZK_DIR}/bin/zkServer.sh start
ExecStop=${ZK_DIR}/bin/zkServer.sh stop
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
SVCEOF

     systemctl daemon-reload
     systemctl enable zookeeper
     systemctl restart zookeeper
     sleep 3
     systemctl is-active --quiet zookeeper && echo 'ZooKeeper is running.' || { echo 'ZooKeeper failed to start.' >&2; exit 1; }" \
    "install ZooKeeper"
}

# install_solr <node> <zk_host_string>
# zk_host_string: comma-separated list of ZK hosts with port, e.g. host1:2181,host2:2181
install_solr() {
  local node="$1"
  local zk_hosts="$2"
  log_node "${node}" "Installing Solr ${SOLR_VERSION}"

  run_with_retry "${node}" \
    "set -euo pipefail
     SOLR_HOME='${SOLR_DIR}'
     SOLR_VERSION='${SOLR_VERSION}'
     SOLR_TARBALL=\"solr-\${SOLR_VERSION}.tgz\"
     SOLR_URL='${SOLR_MIRROR}/\${SOLR_VERSION}/\${SOLR_TARBALL}'
     SOLR_DATA='${DATA_DIR}/solr'

     # Idempotency check
     if [[ -f \"\${SOLR_HOME}/bin/solr\" ]]; then
       echo 'Solr already installed — skipping download.'
     else
       mkdir -p '${INSTALL_DIR}'
       wget -q -O \"/tmp/\${SOLR_TARBALL}\" \"\${SOLR_URL}\"
       tar -xzf \"/tmp/\${SOLR_TARBALL}\" -C '${INSTALL_DIR}'
       mv '${INSTALL_DIR}/solr-${SOLR_VERSION}' \"\${SOLR_HOME}\"
       rm -f \"/tmp/\${SOLR_TARBALL}\"
     fi

     # Data dir
     mkdir -p \"\${SOLR_DATA}\"

     # solr.in.sh — environment config
     sed -i 's|^#SOLR_HEAP=.*|SOLR_HEAP=\"2g\"|' \"\${SOLR_HOME}/bin/solr.in.sh\"
     sed -i 's|^#ZK_HOST=.*|ZK_HOST=\"${zk_hosts}\"|' \"\${SOLR_HOME}/bin/solr.in.sh\"
     sed -i 's|^#SOLR_DATA_HOME=.*|SOLR_DATA_HOME=\"\${SOLR_DATA}\"|' \"\${SOLR_HOME}/bin/solr.in.sh\"

     # Systemd service — paths already resolved to literals
     cat > /etc/systemd/system/solr.service <<SVCEOF
[Unit]
Description=Apache Solr
After=network.target zookeeper.service

[Service]
Type=forking
User=root
Environment=JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
ExecStart=${SOLR_DIR}/bin/solr start -cloud
ExecStop=${SOLR_DIR}/bin/solr stop -all
Restart=on-failure
RestartSec=15

[Install]
WantedBy=multi-user.target
SVCEOF

     systemctl daemon-reload
     systemctl enable solr
     systemctl restart solr
     sleep 5
     \"\${SOLR_HOME}/bin/solr\" status | grep -q 'running' && echo 'Solr is running.' || { echo 'Solr failed to start.' >&2; exit 1; }" \
    "install Solr"
}

# =============================================================================
# HEALTH CHECK
# =============================================================================

health_check() {
  local node="$1"
  log_node "${node}" "Running health checks"

  ssh_exec "${node}" \
    "set -euo pipefail
     errors=0

     # Java
     java -version 2>&1 | grep -q 'openjdk' || { echo 'FAIL: Java not found' >&2; errors=\$((errors+1)); }

     # ZooKeeper
     systemctl is-active --quiet zookeeper || { echo 'FAIL: zookeeper service not active' >&2; errors=\$((errors+1)); }
     echo ruok | nc -w 2 localhost 2181 2>/dev/null | grep -q imok || { echo 'FAIL: ZooKeeper not responding to ruok' >&2; errors=\$((errors+1)); }

     # Solr
     systemctl is-active --quiet solr || { echo 'FAIL: solr service not active' >&2; errors=\$((errors+1)); }
     curl -sf 'http://localhost:8983/solr/admin/info/system?wt=json' >/dev/null || { echo 'FAIL: Solr HTTP endpoint unreachable' >&2; errors=\$((errors+1)); }

     if [[ \${errors} -eq 0 ]]; then
       echo 'All health checks passed.'
     else
       echo \"\${errors} health check(s) failed.\" >&2
       exit 1
     fi"
}

# =============================================================================
# PER-NODE PROVISIONING PIPELINE
# =============================================================================

# provision_node <node> <node_index>
provision_node() {
  local node="$1"
  local idx="$2"
  local node_log="${LOG_DIR}/node_${node}.log"

  # Build ZooKeeper host string: host1:2181,...,hostN:2181
  local zk_hosts=""
  for i in $(seq 1 "${NODE_COUNT}"); do
    zk_hosts+="${BASE_IP}.${i}:2181"
    [[ $i -lt ${NODE_COUNT} ]] && zk_hosts+=","
  done

  log_node "${node}" "=== Provisioning started ==="
  mkdir -p "${LOG_DIR}"
  : > "${node_log}"

  local ok=true

  install_java       "${node}"                  || ok=false
  $ok && install_zookeeper "${node}" "${idx}"   || ok=false
  $ok && install_solr      "${node}" "${zk_hosts}" || ok=false
  $ok && health_check      "${node}"            || ok=false

  if $ok; then
    log_node "${node}" "=== Provisioning SUCCEEDED ==="
  else
    log "ERROR" "[${node}] === Provisioning FAILED — see ${node_log} ==="
    # Signal failure to the parent process via a temp file
    touch "${LOG_DIR}/failed_${node}"
  fi
}

# =============================================================================
# MAIN
# =============================================================================

main() {
  mkdir -p "${LOG_DIR}"
  log "INFO" "Starting cluster provisioning"
  log "INFO" "Nodes: ${NODES[*]}"
  log "INFO" "Logs: ${LOG_DIR}"

  # Verify SSH connectivity to all nodes before doing any work
  log "INFO" "Verifying SSH connectivity..."
  local unreachable=0
  for node in "${NODES[@]}"; do
    if ! ssh_exec "${node}" "true"; then
      log "ERROR" "Cannot reach ${node} via SSH — aborting."
      unreachable=$(( unreachable + 1 ))
    fi
  done
  if (( unreachable > 0 )); then
    log "ERROR" "${unreachable} node(s) unreachable. Fix connectivity before proceeding."
    exit 1
  fi
  log "INFO" "All nodes reachable."

  # Launch parallel provisioning with concurrency cap
  declare -a pids=()
  local running=0
  local idx=0

  for node in "${NODES[@]}"; do
    idx=$(( idx + 1 ))

    # Wait if we have hit the concurrency limit
    while (( running >= MAX_PARALLEL )); do
      # Collect one finished job
      local new_pids=()
      local reaped=0
      for pid in "${pids[@]}"; do
        if [[ -z "${pid}" ]]; then
          continue
        fi
        if (( reaped == 0 )) && ! kill -0 "${pid}" 2>/dev/null; then
          wait "${pid}" 2>/dev/null || true
          running=$(( running - 1 ))
          reaped=1
        else
          new_pids+=("${pid}")
        fi
      done
      pids=("${new_pids[@]+"${new_pids[@]}"}")
      sleep 1
    done

    log "INFO" "Launching provisioning for ${node} (idx=${idx})"
    provision_node "${node}" "${idx}" &
    pids+=($!)
    running=$(( running + 1 ))
  done

  # Wait for all remaining background jobs
  wait

  # Collect failed nodes
  for node in "${NODES[@]}"; do
    if [[ -f "${LOG_DIR}/failed_${node}" ]]; then
      FAILED_NODES+=("${node}")
      rm -f "${LOG_DIR}/failed_${node}"
    fi
  done

  # Summary
  log "INFO" "============================================"
  local total="${#NODES[@]}"
  local failed="${#FAILED_NODES[@]}"
  local succeeded=$(( total - failed ))
  log "INFO" "Provisioning complete: ${succeeded}/${total} nodes succeeded"

  if (( failed > 0 )); then
    log "ERROR" "Failed nodes: ${FAILED_NODES[*]}"
    log "ERROR" "Review individual logs in ${LOG_DIR}/"
    exit 1
  fi

  log "INFO" "Cluster provisioning finished successfully."
}

main "$@"
