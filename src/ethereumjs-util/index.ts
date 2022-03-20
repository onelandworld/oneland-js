const createKeccakHash = require('keccak')

/**
 * Creates SHA-3 hash of the input
 * @param {Buffer|Array|String|Number} a the input data
 * @param {Number} [bits=256] the SHA width
 * @return {Buffer}
 */
const sha3 = function (a: Buffer | String, bits = 256) {
  const buffer = Buffer.from(a);

  return createKeccakHash('keccak' + bits).update(buffer).digest()
}

export const ethUtil = {
  sha3
};

