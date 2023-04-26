// SPDX-License-Identifier: Apache 2

pragma solidity ^0.8.19;

import "@openzeppelin/contracts/utils/introspection/IERC165.sol";

//to what extent (if any) do we want to enforce the structure of the payload?
// potentially:
//  2 bytes for chainId
// 32 bytes for recipientAddress
// xx bytes for nftData

//what about batch sending/receiving?

interface IWormholeNftSender is IERC165 {
  //allow querying of all supported chains?
  //function listTargetChainIds() external view returns (uint16[] memory);

  function supportsTargetChain(uint16 targetChain) external view returns (bool);

  //enforce `returns (uint256 sequenceNumber)`?
  //must be payable for Wormhole message fee
  function burnAndSend(
    uint256 tokenId,
    uint16 targetChain,
    bytes32 recipientAddress
  ) external payable;

  //provide function with optional extraData to cover additional use cases?
  // function burnAndSend(
  //   uint256 tokenId,
  //   uint16 targetChain,
  //   bytes32 recipientAddress,
  //   bytes memory extraData
  // ) external payable;
}

interface IWormholeNftReceiver is IERC165 {
  //allow querying of all registered emitters (one per chain)?
  // struct CrossChainAddress {
  //   uint16 wormholeChainId;
  //   bytes32 foreignAddress;
  // }
  //function listEmitters() external view returns (CrossChainAddress[] memory);

  function getEmitterAddress(uint16 wormholeChainId) external view returns (bytes32);
  
  //enforce `returns (uint256 tokenId, address recipient)`?
  function receiveAndMint(bytes memory vaa) external payable;

  //provide function with optional extraData and payable to cover additional use cases?
  //function receiveAndMint(bytes memory vaa, bytes memory extraData) external payable;
}
