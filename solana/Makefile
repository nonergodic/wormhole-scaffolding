.DEFAULT_GOAL = build
.PHONY: build test unit-test integration-test clean

NETWORK ?= devnet #by default we build for devnet
NETWORK := $(strip $(NETWORK))
export supported_networks := mainnet testnet devnet
ifeq ($(strip $(filter $(supported_networks),$(NETWORK))),)
  $(error Invalid choice $(NETWORK) for NETWORK - must be one of $(supported_networks))
endif

# ----------------------------------------- IMPLEMENTATION -----------------------------------------

.PHONY: dependencies

#Ok, the following build code is a bit of a doosy, so bear with me.
#
#Our goal is to avoid having to go through Anchor's silly, Rube Goldberg-esque "build, get the
# generated keypairs/program ids, manually replace the program ids in the declare_id! macros as well
# as in Anchor.toml, then build for real so we can finally actually deploy" process. <insert
# exasperated rant about lack of DRY and non-streamlined build processes here>
#
#To accomplish this we:
# 1. determine the program ids (using `anchor list keys`)
# 2. then generate Anchor.toml dynamically (with the help of Anchor.toml.base)
# 3. and finally pass the program ids to Rust in a way that they can be used at compile time
#
#All three steps are annoyingly finicky - hence this long elaboration.
#
#Right off the bat we run into a catch-22 type situation because to run `anchor list keys`, which
# prints the program ids of our programs, we need Anchor.toml to exist (in particular, it needs the
# provider that's specified in there). We cut the Gordian knot by temporarily replacing any existing
# Anchor.toml with its .base version, then runing `anchor list keys`, and then undoing things again.
#
#(We can't just use copy without overwrite (cp -n) because if Anchor.toml was deleted manually it
# would fail to trigger a proper rebuild because now Anchor.toml is already newer than its
# dependencies.)
#
#For passing the program ids to Rust, it would be preferable to just set them in environment
# variables and pass those values to the declare_id! macro. However, the declare_id! macro expects
# either a string literal or a Pubkey struct, but reading environment variables at compile time via
# the env! macro yields &'static str and there is no good way to convert a base58 encoded str into a
# Pubkey at compile time (the only const constructor function that Pubkey offers takes a [u8; 32]
# byte array and in turn the decode function of the base58 crate that Solana uses is not const and
# so we can't actually convert our base58 str into said byte array at compile time).
#Thus we instead use the include_bytes! macro to read the program id as a byte array from a file
# that that we create with our generate_pid_bytes_file.ts TypeScript script.
#
#Overall this process is a lot more involved than I'd like and hence far from elegant, but at least
# we now only have to build once and be done and don't have to manually specify/update the program
# ids everywhere.

#initialize 'programs' as a variable that's expanded immediately, otherwise the subsequent += pname
# call won't be expanded in time and thus programs would erroneously end up empty
programs :=
define expand_program_definitions_block
$(eval name_id := $(subst :, ,$(1)))
$(eval pname := $(word 1, $(name_id)))
$(eval $(pname)_base58_pid := $(word 2, $(name_id)))
$(eval $(pname)_keypair_file := $(CURDIR)/target/deploy/$(pname)-keypair.json)
$(eval $(pname)_pid_bin_file := $(CURDIR)/target/deploy/$(pname)-program_id.bin)
$(eval programs += $(pname))

$(eval $($(pname)_pid_bin_file): $($(pname)_keypair_file) node_modules
	yarn run ts-node ts/generate_pid_bytes_file.ts $($(pname)_base58_pid) $($(pname)_pid_bin_file))
$(eval undefine name_id pname)
endef

#anchor keys list generates keypair files in target/deploy as a side effect if they don't exist yet!
anchor_list_keys := $(shell \
  mv -f Anchor.toml Anchor.toml.tmp 2>/dev/null; cp Anchor.toml.base Anchor.toml; \
	anchor keys list | sed -n 's/\s*//pg'; \
	rm Anchor.toml; mv -f Anchor.toml.tmp Anchor.toml 2>/dev/null)
$(foreach prognkey,$(anchor_list_keys),$(call expand_program_definitions_block,$(prognkey)))
undefine anchor_list_keys

program_id_bin_files = $(foreach pname,$(programs),$($(pname)_pid_bin_file))
program_id_env_vars = $(foreach pname,$(programs),$(pname)_PROGRAM_ID_FILE=$($(pname)_pid_bin_file))
$(foreach envvar,$(program_id_env_vars),$(eval export $(envvar)))

test: unit-test integration-test

unit-test: build
	cargo clippy -- --allow clippy::result_large_err
	cargo test

integration-test: build
	anchor test

build: dependencies Anchor.toml node_modules $(program_id_bin_files)
	@echo "> Building programs"
	anchor build

dependencies:
	@echo "> Building dependencies for $(NETWORK)"
	@$(MAKE) -C dependencies NETWORK=$(NETWORK)

clean:
	@$(MAKE) -C dependencies clean
	rm -rf node_modules target .anchor Anchor.toml


create_toml_program_table = \
 's/^\([a-zA-Z_]*\)\s*=\s*\([a-zA-Z0-9]*\)$$/\n[$(1)]\naddress = "\2"\nprogram = ".\/$(2)\1.so"/p'
Anchor.toml: Anchor.toml.base dependencies/$(NETWORK)/wormhole_program_ids.toml \
    $(foreach pname,$(programs),$($(pname)_keypair_file))
	@echo "> Generating Anchor.toml"
	printf %b "######################################################################\n" \
	          "# This file is autogenerated by make - edit Anchor.toml.base instead #\n" \
	          "######################################################################\n" \
	  > Anchor.toml
	cat Anchor.toml.base >> Anchor.toml
	cat dependencies/$(NETWORK)/wormhole_program_ids.toml | \
		sed -n $(call create_toml_program_table,[test.genesis],dependencies\/$(NETWORK)\/) \
		>> Anchor.toml
	printf %b "\n[programs.localnet]\n" \
	  	$(foreach pname,$(programs),"$(pname) = \"$($(pname)_base58_pid)\"\n") \
		>> Anchor.toml

dependencies/$(NETWORK)/wormhole_program_ids.toml: dependencies
	
node_modules: package.json yarn.lock
	@echo "> Updating node modules"
	yarn
	touch node_modules
