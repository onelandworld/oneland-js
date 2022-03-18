/**
 * Ref: https://github.com/onelandworld/wyvern-v3/blob/master/test/eip712.js
 */
import * as ethUtil from 'ethereumjs-util';
import {ethABI} from '../ethereumjs-abi';

const eip712Domain = {
  name: 'EIP712Domain',
  fields: [
    {name: 'name', type: 'string'},
    {name: 'version', type: 'string'},
    {name: 'chainId', type: 'uint256'},
    {name: 'verifyingContract', type: 'address'},
  ],
};

function encodeType(name: any, fields: any) {
  const result = `${name}(${fields
    .map(({name, type}) => `${type} ${name}`)
    .join(',')})`;
  return result;
}

function typeHash(name: any, fields: any) {
  return ethUtil.sha3(encodeType(name, fields));
}

function encodeData(name: any, fields: any, data: any) {
  const encTypes = [];
  const encValues = [];

  // Add typehash
  encTypes.push('bytes32');
  encValues.push(typeHash(name, fields));

  // Add field contents
  for (const field of fields) {
    let value = data[field.name];
    if (field.type === 'string' || field.type === 'bytes') {
      encTypes.push('bytes32');
      value = ethUtil.sha3(value);
      encValues.push(value);
    } else {
      encTypes.push(field.type);
      encValues.push(value);
    }
  }

  // console.log('encodeData', encTypes, encValues);
  return ethABI.rawEncode(encTypes, encValues);
}

function structHash(name: any, fields: any, data: any) {
  return ethUtil.sha3(encodeData(name, fields, data));
}

export const eip712 = {
  eip712Domain,
  structHash,
};
