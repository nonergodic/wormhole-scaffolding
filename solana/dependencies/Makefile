.PHONY: all clean

#we don't use the nft_bridge program so we don't include it here
WORMHOLE_BRIDGES := bridge token_bridge
wormhole_sos := $(addsuffix .so, $(WORMHOLE_BRIDGES))

all: $(wormhole_sos) mpl_token_metadata.so

clean:
	rm -f *.so

#building Wormhole bridges with Solana version 1.15 or newer causes very strange behavior with
# the BPFLoaderUpgradeab1e program and how Wormhole bridges are loaded into the Solana validator
# hence this version check.
#This check should be removed once this issue has been resolved.
solana_version := $(shell solana --version 2>/dev/null | \
                    sed -n 's/^solana-cli \([0-9\.]*\) .*$$/\1/p')
max_solana_version := 1.15.0
ifndef solana_version
	$(error "Solana not installed - please install version 1.14.14 \(< $(max_solana_version)!\)")
endif
ifeq ($(shell printf '%s\n' "$(solana_version)" "$(max_solana_version)" | sort -V | head -n1), \
      $(max_solana_version))
	$(error "Solana version too new - please downgrade to 1.14.14")
endif

#no way to escape parenthesis inline
lparen := (
rparen := )
$(wormhole_sos)&: #&: specifies a grouped target
	@echo "> Fetching Solana bridge programs from Wormhole repo"
	rm -rf tmp-wormhole
	git clone \
	  --depth 1 \
	  --branch main \
	  --filter=blob:none \
	  --sparse \
	  https://github.com/wormhole-foundation/wormhole \
	  tmp-wormhole > /dev/null 2>&1
	cd tmp-wormhole; git sparse-checkout set solana > /dev/null 2>&1
	@echo "> Building Wormhole Solana bridges"
	cd tmp-wormhole/solana; ${MAKE} artifacts NETWORK=$(NETWORK)
	mv $(addprefix tmp-wormhole/solana/artifacts-$(NETWORK)/,$(wormhole_sos)) .
	cat tmp-wormhole/solana/Makefile | \
		grep '^\(\($(subst $(space),\$(rparen)\|\$(lparen),$(WORMHOLE_BRIDGES))\)\)' | \
		sed -n 's/^\(.*\)_ADDRESS_$(NETWORK)=\(.*\)$$/\1 = \2/p' \
		> wormhole_program_ids.toml
	rm -rf tmp-wormhole

mpl_token_metadata.so:
	@echo "> Fetching Metaplex token metadata program from Metaplex repo"
	rm -rf tmp-metaplex
	git clone https://github.com/metaplex-foundation/metaplex-program-library.git \
    tmp-metaplex > /dev/null 2>&1

	@echo "> Building Metaplex token metadata program"
#metaplex build script expects to be run from the root of its repo
	cd tmp-metaplex; ./build.sh token-metadata

	mv tmp-metaplex/test-programs/mpl_token_metadata.so .
	rm -rf tmp-metaplex
