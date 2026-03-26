# Step-by-Step Guide: `provision-cluster.sh`

This document walks through every part of the `scripts/provision-cluster.sh` script so you can understand what it does, why it does it, and how to use it safely.

---

## What Does This Script Do?

`provision-cluster.sh` automates the setup of a **distributed ZooKeeper + Solr cluster** across multiple Ubuntu VMs (e.g., on OVHcloud). Running it from your local machine (the *control machine*) will:

1. Connect to each VM over SSH.
2. Install **Java 17** (required by both ZooKeeper and Solr).
3. Install and configure **Apache ZooKeeper** (distributed coordination service).
4. Install and configure **Apache Solr** in **SolrCloud** mode (backed by ZooKeeper).
5. Run **health checks** on every node.
6. Produce a **summary report** of successes and failures.

All steps run in parallel (up to 5 nodes at a time) to save time on large clusters.

---

## Prerequisites

Before running the script, ensure the following are in place on your control machine:

| Requirement | Details |
|---|---|
| Bash ≥ 4.0 | `bash --version` to check |
| `ssh`, `scp`, `ssh-keyscan` | Usually pre-installed on Linux/macOS |
| SSH key pair | Private key at `~/.ssh/id_rsa` by default |
| Passwordless SSH | Each VM must accept login via the key without a password prompt |
| Network access | Control machine must reach all VM IPs on port 22 |

---

## Step 1 — Configuration Block

```bash
readonly NODE_COUNT=11
readonly BASE_IP="10.1.16"
```

**What it does:** Defines how many nodes exist and their IP address pattern. With `NODE_COUNT=11` and `BASE_IP="10.1.16"`, the script targets nodes `10.1.16.1` through `10.1.16.11`.

**Customise this** before running:

| Variable | Default | Purpose |
|---|---|---|
| `NODE_COUNT` | `11` | Total number of VMs |
| `BASE_IP` | `10.1.16` | First three octets of node IPs |
| `SSH_USER` | `ubuntu` | Linux user for SSH login |
| `SSH_KEY` | `~/.ssh/id_rsa` | Path to your SSH private key |
| `JAVA_PACKAGE` | `openjdk-17-jdk-headless` | Java package to install via apt |
| `ZOOKEEPER_VERSION` | `3.9.2` | ZooKeeper release to download |
| `SOLR_VERSION` | `9.6.0` | Solr release to download |
| `INSTALL_DIR` | `/opt` | Base directory for software on VMs |
| `DATA_DIR` | `/var/data` | Base directory for runtime data |
| `MAX_PARALLEL` | `5` | Max concurrent SSH provisioning jobs |
| `MAX_RETRIES` | `3` | How many times to retry a failed step |
| `RETRY_DELAY` | `15` | Seconds to wait between retries |

---

## Step 2 — Build the Node List

```bash
declare -a NODES=()
for i in $(seq 1 "${NODE_COUNT}"); do
  NODES+=("${BASE_IP}.${i}")
done
```

**What it does:** Generates an array of IP addresses (`NODES`) by appending `.1`, `.2`, … `.11` to the base IP. The result is:

```
NODES = (10.1.16.1  10.1.16.2  ...  10.1.16.11)
```

This array is used throughout the script to iterate over every node.

---

## Step 3 — Utility Functions

### `log` / `log_node`

```bash
log "INFO" "Starting cluster provisioning"
log_node "10.1.16.1" "Installing Java"
```

Prints a timestamped, levelled message to the terminal **and** appends it to a central log file at `/tmp/provision-logs/provision_<timestamp>.log`. Each node also gets its own log file: `/tmp/provision-logs/node_<IP>.log`.

### `ssh_exec <node> <command>`

```bash
ssh_exec "10.1.16.1" "echo hello"
```

Runs a single shell command on a remote node over SSH. Options used:
- `-o StrictHostKeyChecking=no` — skips the "do you trust this host?" prompt.
- `-o ConnectTimeout=10` — fails fast if the node is unreachable.
- `-i <SSH_KEY>` — authenticates with your private key.

Output (stdout + stderr) goes only to the node's log file, keeping the terminal clean.

### `run_with_retry <node> <command> [description]`

```bash
run_with_retry "10.1.16.1" "apt-get install -y openjdk-17-jdk-headless" "install Java"
```

Wraps `ssh_exec` with a retry loop. If the command fails, it waits `RETRY_DELAY` seconds and tries again, up to `MAX_RETRIES` times. This handles transient network hiccups or slow package mirrors gracefully.

---

## Step 4 — Install Java (`install_java`)

```bash
install_java "10.1.16.1"
```

**Remote command executed:**
```bash
export DEBIAN_FRONTEND=noninteractive
if java -version 2>/dev/null | grep -q 'openjdk'; then
  echo 'Java already installed — skipping.'
else
  apt-get update -qq && apt-get install -y -qq openjdk-17-jdk-headless
fi
```

**Key points:**
- **Idempotent**: if Java is already installed, this step is skipped without error.
- `DEBIAN_FRONTEND=noninteractive` suppresses apt interactive prompts.
- `-qq` reduces apt output noise.
- Retried up to 3 times via `run_with_retry`.

---

## Step 5 — Install ZooKeeper (`install_zookeeper`)

```bash
install_zookeeper "10.1.16.1" 1    # node IP, myid
```

ZooKeeper is the distributed coordination backbone for SolrCloud. Each node in the ZooKeeper ensemble must have a **unique numeric ID** (`myid`).

**What happens on the remote node:**

### 5a — Download & Extract
```bash
wget -q -O /tmp/apache-zookeeper-3.9.2-bin.tar.gz \
  https://downloads.apache.org/zookeeper/3.9.2/apache-zookeeper-3.9.2-bin.tar.gz
tar -xzf /tmp/apache-zookeeper-3.9.2-bin.tar.gz -C /opt
mv /opt/apache-zookeeper-3.9.2-bin /opt/zookeeper
```

Skipped if `/opt/zookeeper/bin/zkServer.sh` already exists (idempotent).

### 5b — Write the `myid` file
```bash
echo '1' > /var/data/zookeeper/myid
```

ZooKeeper uses this file to identify which server it is within the ensemble.

### 5c — Generate `zoo.cfg`
```
tickTime=2000          # heartbeat interval (ms)
initLimit=10           # follower connection timeout (in ticks)
syncLimit=5            # follower sync lag limit (in ticks)
dataDir=/var/data/zookeeper
dataLogDir=/var/data/zookeeper-logs
clientPort=2181        # client connection port
maxClientCnxns=60      # max connections per client IP
autopurge.snapRetainCount=3
autopurge.purgeInterval=1   # hours between automatic snapshot cleanup
server.1=10.1.16.1:2888:3888
server.2=10.1.16.2:2888:3888
...
server.11=10.1.16.11:2888:3888
```

Ports `2888` (leader↔follower) and `3888` (leader election) are ZooKeeper-internal. Port `2181` is for client connections (used by Solr).

### 5d — Create a systemd service
The service starts ZooKeeper automatically on boot and restarts it on failure.

```ini
[Service]
ExecStart=/opt/zookeeper/bin/zkServer.sh start
ExecStop=/opt/zookeeper/bin/zkServer.sh stop
Restart=on-failure
RestartSec=10
```

### 5e — Enable & start
```bash
systemctl daemon-reload
systemctl enable zookeeper
systemctl restart zookeeper
```

Verified with `systemctl is-active --quiet zookeeper`.

---

## Step 6 — Install Solr (`install_solr`)

```bash
install_solr "10.1.16.1" "10.1.16.1:2181,10.1.16.2:2181,...,10.1.16.11:2181"
```

Solr is the search engine. In **SolrCloud** mode it stores its cluster state in ZooKeeper, enabling distributed indexing and querying.

### 6a — Download & Extract
```bash
wget -q -O /tmp/solr-9.6.0.tgz \
  https://downloads.apache.org/solr/solr/9.6.0/solr-9.6.0.tgz
tar -xzf /tmp/solr-9.6.0.tgz -C /opt
mv /opt/solr-9.6.0 /opt/solr
```

Skipped if `/opt/solr/bin/solr` already exists (idempotent).

### 6b — Configure `solr.in.sh`

Three `sed` commands update the environment file:

| Setting | Value | Purpose |
|---|---|---|
| `SOLR_HEAP` | `2g` | JVM heap size for Solr |
| `ZK_HOST` | all 11 nodes at port 2181 | Connects Solr to the ZooKeeper ensemble |
| `SOLR_DATA_HOME` | `/var/data/solr` | Where Solr stores index data |

### 6c — Create a systemd service

```ini
[Unit]
After=network.target zookeeper.service   # starts after ZooKeeper

[Service]
ExecStart=/opt/solr/bin/solr start -cloud   # SolrCloud mode
ExecStop=/opt/solr/bin/solr stop -all
Restart=on-failure
RestartSec=15
```

### 6d — Enable & start
```bash
systemctl daemon-reload
systemctl enable solr
systemctl restart solr
```

Verified with `solr status | grep -q 'running'`.

---

## Step 7 — Health Checks (`health_check`)

After installation, the script runs four checks on each node:

| Check | What it verifies |
|---|---|
| `java -version` | Java is installed and is OpenJDK |
| `systemctl is-active zookeeper` | ZooKeeper service is running |
| `echo ruok \| nc localhost 2181` → `imok` | ZooKeeper is responding to clients (the "Are You OK?" command) |
| `systemctl is-active solr` | Solr service is running |
| `curl http://localhost:8983/solr/admin/info/system` | Solr HTTP API is reachable |

All five checks must pass. If any fail, the error count is reported and the function exits with code 1, marking the node as failed.

---

## Step 8 — Per-Node Pipeline (`provision_node`)

```
provision_node "10.1.16.1" 1
```

This function sequences everything for **one node**:

```
install_java → install_zookeeper → install_solr → health_check
```

If any step fails, subsequent steps for that node are skipped. A failure sentinel file (`/tmp/provision-logs/failed_<IP>`) is created so the main process can detect it after all parallel jobs finish.

---

## Step 9 — Main Orchestration (`main`)

### 9a — SSH Connectivity Pre-Check

Before doing any real work, the script tests that every node is reachable:

```bash
for node in "${NODES[@]}"; do
  ssh_exec "${node}" "true"
done
```

If **any** node is unreachable, the script aborts immediately with an error message listing the unreachable node(s). Fix connectivity first, then re-run.

### 9b — Parallel Provisioning with Concurrency Cap

```
MAX_PARALLEL = 5
```

The script launches `provision_node` as a **background process** for each node, but never runs more than 5 simultaneously. This prevents overwhelming the control machine or the network.

**How the concurrency cap works:**
1. A `running` counter tracks active background jobs.
2. When `running >= MAX_PARALLEL`, the main loop waits, checking every second for a finished job before launching the next.
3. Once a job finishes, `running` is decremented and a new node is started.

After all nodes have been started, `wait` blocks until the last background jobs finish.

### 9c — Collect Results & Summary

```bash
for node in "${NODES[@]}"; do
  if [[ -f "${LOG_DIR}/failed_${node}" ]]; then
    FAILED_NODES+=("${node}")
  fi
done
```

The sentinel files written by failed `provision_node` calls are collected into `FAILED_NODES`. A final summary is printed:

```
Provisioning complete: 10/11 nodes succeeded
Failed nodes: 10.1.16.7
Review individual logs in /tmp/provision-logs/
```

If any node failed, the script exits with code `1` (non-zero), making it easy to detect failure in CI pipelines.

---

## Full Execution Flow Diagram

```
main()
 ├─ Verify SSH to all 11 nodes
 │
 ├─ For each node (up to 5 in parallel):
 │   └─ provision_node(IP, idx)
 │       ├─ install_java          [with retry]
 │       ├─ install_zookeeper     [with retry]
 │       │   ├─ Download tarball
 │       │   ├─ Write myid
 │       │   ├─ Write zoo.cfg
 │       │   ├─ Write systemd unit
 │       │   └─ Enable + start service
 │       ├─ install_solr          [with retry]
 │       │   ├─ Download tarball
 │       │   ├─ Configure solr.in.sh
 │       │   ├─ Write systemd unit
 │       │   └─ Enable + start service
 │       └─ health_check
 │           ├─ Java version check
 │           ├─ ZooKeeper service active?
 │           ├─ ZooKeeper ruok/imok check
 │           ├─ Solr service active?
 │           └─ Solr HTTP endpoint reachable?
 │
 └─ Print summary (succeeded / failed nodes)
```

---

## Logs

| Log File | Contents |
|---|---|
| `/tmp/provision-logs/provision_<timestamp>.log` | All top-level log messages |
| `/tmp/provision-logs/node_<IP>.log` | Full SSH output for that specific node |
| `/tmp/provision-logs/failed_<IP>` | Sentinel file created when a node fails (deleted after reading) |

If a node fails, inspect its log file for the specific error:

```bash
cat /tmp/provision-logs/node_10.1.16.7.log
```

---

## Common Issues & Fixes

| Symptom | Likely Cause | Fix |
|---|---|---|
| "Cannot reach X via SSH" | Key not authorised or wrong user | Add your public key to `~/.ssh/authorized_keys` on the VM; verify `SSH_USER` |
| "ZooKeeper failed to start" | Java not installed, or port 2888/3888 blocked | Check `node_<IP>.log`; open firewall ports between nodes |
| "Solr failed to start" | ZooKeeper not yet fully elected a leader | Re-run; ZooKeeper may need a moment to elect a leader when first started |
| `wget` fails | Download mirror blocked or slow | Change `ZK_MIRROR` / `SOLR_MIRROR` to a closer mirror |
| Script re-run installs nothing | Idempotency checks skip already-installed software | This is correct behaviour; re-run is safe |

---

## Quick Reference: Ports Used

| Port | Protocol | Purpose |
|---|---|---|
| 22 | TCP | SSH (control machine → nodes) |
| 2181 | TCP | ZooKeeper client port (Solr → ZooKeeper) |
| 2888 | TCP | ZooKeeper leader↔follower communication |
| 3888 | TCP | ZooKeeper leader election |
| 8983 | TCP | Solr HTTP API (clients → Solr) |
