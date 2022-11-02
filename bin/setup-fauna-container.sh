
#!/bin/bash
# docker-migrations.sh
set -e
containername='fsm_fauna'
MAX_TRIES=10
# Return true-like values if and only if logs
# contain the expected "ready" line
function dbIsReady() {
docker logs $containername 2>&1 | grep "Node has initialized the cluster\|Node has NOT initialized the cluster. It is already a member of a cluster\|Replica name: NoDC"
}

function waitUntilServiceIsReady() {
  attempt=1
  while [ $attempt -le $MAX_TRIES ]; do
    if "$@"; then
      echo "$2 container is up!"
      break
    fi
    echo "Waiting for $2 container... (attempt: $((attempt++)))"
    sleep 5
  done

  if [ $attempt -gt $MAX_TRIES ]; then
    echo "Error: $2 not responding, cancelling set up"
    docker container logs $containername
    exit 1
  fi
}

waitUntilServiceIsReady dbIsReady "FaunaDB"
