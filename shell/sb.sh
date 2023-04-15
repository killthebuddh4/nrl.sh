#!/bin/sh


curl -H 'Content-Type: application/json' -XPOST 'localhost:8080/socrates/breadth' -d "{\"rootId\": \"9cc0cee9-8ed3-407c-a74a-07e5afb5b73f\", \"nodeId\": \"9cc0cee9-8ed3-407c-a74a-07e5afb5b73f\" }"