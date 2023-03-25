#!/bin/bash

git clone https://github.com/metaplex-foundation/metaplex-program-library.git \
  tmp-metaplex > /dev/null 2>&1

cd tmp-metaplex #metaplex build script expects to be run from the root its repo
./build.sh token-metadata
cd ..

mv tmp-metaplex/test-programs/mpl_token_metadata.so .
rm -rf tmp-metaplex

exit 0
