include testing.env

.PHONY: all build dependencies test unit-test integration-test clean 

all: build

build: dependencies
	forge build
	yarn build-types

dependencies: node_modules lib/forge-std

test: forge-test integration-test

unit-test: build
	forge test --fork-url ${TESTING_AVAX_FORK_RPC} -vv

integration-test: build
	bash shell-scripts/run_integration_tests.sh

clean:
	rm -rf anvil.log node_modules lib out


node_modules:
	yarn


lib/forge-std:
	forge install foundry-rs/forge-std --no-git --no-commit
