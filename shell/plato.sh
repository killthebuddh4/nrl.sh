#!/bin/sh


curl -H 'Content-Type: application/json' -XPOST 'localhost:8080/plato' -d "{\"interlocutor\": \"PHAEDRUS\", \"message\": \"What is the fastest way to travel from Los Angeles to Bozeman Montana without setting foot in a motorized vehicle?\"}"