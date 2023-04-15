#!/bin/sh


curl -H 'Content-Type: application/json' -XPOST 'localhost:8080/socrates/breadth' -d "{\"question\": \"What is the fastest way to travel from Los Angeles to Bozeman Montana without setting foot in a motorized vehicle?\"}"
# curl -H 'Content-Type: application/json' -XPOST 'localhost:8080/ask' -d "{\"question\": \"Can you please explain to me how the DAI stablecoin works?\"}"
# curl -H 'Content-Type: application/json' -XPOST 'localhost:8080/ask' -d "{\"question\": \"What weighs more, a Grizzly bear or a house cat?\"}"
