// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.19;

// import "../wormhole/IWormholeNft.sol";

// abstract contract WormholeNftSender is IWormholeNftSender {
//   error targetChainNotSupported();

//   function _sendNft(
//     uint16 targetChain,
//     bytes32 recipientAddress,
//     bytes memory nftData
//   ) internal {
//     if (!supportsTargetChain(targetChain)) {
//       revert targetChainNotSupported();
//     }

//     uint32 unusedNonce = 0;
//     bytes memory payload = abi.encodePacked(targetChain, recipientAddress, nftData);
//     uint8 finalized = 201; //see https://book.wormhole.com/wormhole/3_coreLayerContracts.html

//     //TODO unclear if relevant: {value: wormholeFee}
//     wormhole.publishMsg(unusedNonce, payload, finalized);
//   }

//   function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
//     return interfaceId == type(IWormholeNftSender).interfaceId
//       || super.supportsInterface(interfaceId);
//   }
// }

// abstract contract WormholeNftReceiver is IWormholeNftReceiver {

//   function supportsInterface(bytes4 interfaceId) public view virtual override returns (bool) {
//     return interfaceId == type(IWormholeNftReceiver).interfaceId
//       || super.supportsInterface(interfaceId);
//   }
// }