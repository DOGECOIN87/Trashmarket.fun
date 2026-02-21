/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/vanity_miner.json`.
 */
export type VanityMiner = {
  "address": "5YSYX6GX3wD2xTp6poLuP92FT8uiWeRFLwASsULXXYM4",
  "metadata": {
    "name": "vanityMiner",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Vanity Miner - Pay-per-batch GOR mining for custom Gorbagana addresses"
  },
  "instructions": [
    {
      "name": "chargeForBatch",
      "docs": [
        "Charge for a mining batch.",
        "Deducts `cost` from user's mining balance and transfers from vault to treasury."
      ],
      "discriminator": [
        34,
        190,
        242,
        155,
        41,
        131,
        182,
        169
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "miningAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  105,
                  110,
                  105,
                  110,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "treasury",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "cost",
          "type": "u64"
        }
      ]
    },
    {
      "name": "deposit",
      "docs": [
        "Deposit GOR into the mining account.",
        "Transfers native GOR from user to the program vault PDA."
      ],
      "discriminator": [
        242,
        35,
        198,
        137,
        82,
        225,
        242,
        182
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "miningAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  105,
                  110,
                  105,
                  110,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initializeUser",
      "docs": [
        "Initialize a new mining account for the user.",
        "Creates a PDA seeded with [\"mining\", user_pubkey]."
      ],
      "discriminator": [
        111,
        17,
        185,
        250,
        60,
        122,
        38,
        254
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "miningAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  105,
                  110,
                  105,
                  110,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "recordMatch",
      "docs": [
        "Record a vanity address match found by the user."
      ],
      "discriminator": [
        148,
        41,
        163,
        203,
        58,
        251,
        192,
        228
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "miningAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  105,
                  110,
                  105,
                  110,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        }
      ],
      "args": [
        {
          "name": "address",
          "type": "string"
        }
      ]
    },
    {
      "name": "withdraw",
      "docs": [
        "Withdraw remaining balance back to the user."
      ],
      "discriminator": [
        183,
        18,
        70,
        156,
        148,
        109,
        161,
        34
      ],
      "accounts": [
        {
          "name": "user",
          "writable": true,
          "signer": true
        },
        {
          "name": "miningAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  109,
                  105,
                  110,
                  105,
                  110,
                  103
                ]
              },
              {
                "kind": "account",
                "path": "user"
              }
            ]
          }
        },
        {
          "name": "vault",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  97,
                  117,
                  108,
                  116
                ]
              }
            ]
          }
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    }
  ],
  "accounts": [
    {
      "name": "miningAccount",
      "discriminator": [
        73,
        230,
        193,
        127,
        252,
        202,
        119,
        190
      ]
    }
  ],
  "events": [
    {
      "name": "batchChargedEvent",
      "discriminator": [
        183,
        199,
        243,
        116,
        197,
        119,
        232,
        225
      ]
    },
    {
      "name": "depositEvent",
      "discriminator": [
        120,
        248,
        61,
        83,
        31,
        142,
        107,
        144
      ]
    },
    {
      "name": "matchFound",
      "discriminator": [
        73,
        161,
        70,
        145,
        232,
        249,
        72,
        211
      ]
    },
    {
      "name": "withdrawEvent",
      "discriminator": [
        22,
        9,
        133,
        26,
        160,
        44,
        71,
        192
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "insufficientBalance",
      "msg": "Insufficient balance for batch"
    },
    {
      "code": 6001,
      "name": "noBalance",
      "msg": "No balance to withdraw"
    },
    {
      "code": 6002,
      "name": "invalidAmount",
      "msg": "Invalid amount"
    },
    {
      "code": 6003,
      "name": "overflow",
      "msg": "Arithmetic overflow"
    },
    {
      "code": 6004,
      "name": "unauthorized",
      "msg": "Unauthorized: not the account owner"
    },
    {
      "code": 6005,
      "name": "invalidTreasury",
      "msg": "Invalid treasury address"
    }
  ],
  "types": [
    {
      "name": "batchChargedEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "cost",
            "type": "u64"
          },
          {
            "name": "remainingBalance",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "depositEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "newBalance",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "matchFound",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "address",
            "type": "string"
          },
          {
            "name": "timestamp",
            "type": "i64"
          },
          {
            "name": "totalMatches",
            "type": "u32"
          }
        ]
      }
    },
    {
      "name": "miningAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "balance",
            "type": "u64"
          },
          {
            "name": "totalSpent",
            "type": "u64"
          },
          {
            "name": "matchesFound",
            "type": "u32"
          },
          {
            "name": "isActive",
            "type": "bool"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "withdrawEvent",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          }
        ]
      }
    }
  ]
};
