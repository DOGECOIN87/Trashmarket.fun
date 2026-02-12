/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/gorbagana_bridge.json`.
 */
export type GorbaganaBridge = {
  "address": "FreEcfZtek5atZJCJ1ER8kGLXB1C17WKWXqsVcsn1kPq",
  "metadata": {
    "name": "gorbaganaBridge",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Gorbagana Bridge - P2P OTC sGOR/gGOR swap program"
  },
  "docs": [
    "Direction 0 = Maker sells sGOR (SPL), wants gGOR (native) in return",
    "Direction 1 = Maker sells gGOR (native), wants sGOR (SPL) in return"
  ],
  "instructions": [
    {
      "name": "cancelOrder",
      "discriminator": [
        95,
        129,
        237,
        240,
        8,
        49,
        223,
        132
      ],
      "accounts": [
        {
          "name": "maker",
          "writable": true,
          "signer": true,
          "relations": [
            "order"
          ]
        },
        {
          "name": "order",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  114,
                  100,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "order.maker",
                "account": "order"
              },
              {
                "kind": "account",
                "path": "order.amount",
                "account": "order"
              }
            ]
          }
        },
        {
          "name": "escrowTokenAccount",
          "docs": [
            "Escrow sGOR token account (direction 0 only)"
          ],
          "writable": true,
          "optional": true
        },
        {
          "name": "makerTokenAccount",
          "docs": [
            "Maker's sGOR token account to receive refund (direction 0 only)"
          ],
          "writable": true,
          "optional": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "createOrder",
      "docs": [
        "Creates an escrow order. The maker deposits funds into the escrow:",
        "- Direction 0 (sGOR→gGOR): maker deposits sGOR via SPL transfer",
        "- Direction 1 (gGOR→sGOR): maker deposits gGOR via system transfer"
      ],
      "discriminator": [
        141,
        54,
        37,
        207,
        237,
        210,
        250,
        215
      ],
      "accounts": [
        {
          "name": "maker",
          "writable": true,
          "signer": true
        },
        {
          "name": "order",
          "docs": [
            "Order PDA — deterministic from maker + amount"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  114,
                  100,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "maker"
              },
              {
                "kind": "arg",
                "path": "amount"
              }
            ]
          }
        },
        {
          "name": "escrowTokenAccount",
          "docs": [
            "Escrow token account for sGOR (only needed for direction 0)",
            "Initialized with the order PDA as authority"
          ],
          "writable": true,
          "optional": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  101,
                  115,
                  99,
                  114,
                  111,
                  119
                ]
              },
              {
                "kind": "account",
                "path": "maker"
              },
              {
                "kind": "arg",
                "path": "amount"
              }
            ]
          }
        },
        {
          "name": "makerTokenAccount",
          "docs": [
            "Maker's sGOR token account (only needed for direction 0)"
          ],
          "writable": true,
          "optional": true
        },
        {
          "name": "sgorMint",
          "docs": [
            "sGOR mint account (needed for escrow_token_account init)"
          ],
          "optional": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        },
        {
          "name": "rent",
          "address": "SysvarRent111111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        },
        {
          "name": "direction",
          "type": "u8"
        },
        {
          "name": "expirationSlot",
          "type": "u64"
        }
      ]
    },
    {
      "name": "fillOrder",
      "docs": [
        "Fills an existing order. The taker provides what the maker wants,",
        "and receives what the maker escrowed.",
        "",
        "Direction 0 (maker sold sGOR):",
        "Taker sends gGOR (native) → Maker",
        "Escrow releases sGOR (SPL) → Taker",
        "",
        "Direction 1 (maker sold gGOR):",
        "Taker sends sGOR (SPL) → Maker",
        "Escrow releases gGOR (native) → Taker"
      ],
      "discriminator": [
        232,
        122,
        115,
        25,
        199,
        143,
        136,
        162
      ],
      "accounts": [
        {
          "name": "taker",
          "writable": true,
          "signer": true
        },
        {
          "name": "maker",
          "writable": true
        },
        {
          "name": "order",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  111,
                  114,
                  100,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "order.maker",
                "account": "order"
              },
              {
                "kind": "account",
                "path": "order.amount",
                "account": "order"
              }
            ]
          }
        },
        {
          "name": "escrowTokenAccount",
          "docs": [
            "Escrow sGOR token account (direction 0)"
          ],
          "writable": true,
          "optional": true
        },
        {
          "name": "takerTokenAccount",
          "docs": [
            "Taker's sGOR token account to send FROM (direction 1)"
          ],
          "writable": true,
          "optional": true
        },
        {
          "name": "takerReceiveTokenAccount",
          "docs": [
            "Taker's sGOR token account to receive INTO (direction 0)"
          ],
          "writable": true,
          "optional": true
        },
        {
          "name": "makerReceiveTokenAccount",
          "docs": [
            "Maker's sGOR token account to receive INTO (direction 1)"
          ],
          "writable": true,
          "optional": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
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
      "name": "order",
      "discriminator": [
        134,
        173,
        223,
        185,
        77,
        86,
        28,
        51
      ]
    }
  ],
  "events": [
    {
      "name": "orderCancelled",
      "discriminator": [
        108,
        56,
        128,
        68,
        168,
        113,
        168,
        239
      ]
    },
    {
      "name": "orderCreated",
      "discriminator": [
        224,
        1,
        229,
        63,
        254,
        60,
        190,
        159
      ]
    },
    {
      "name": "orderFilled",
      "discriminator": [
        120,
        124,
        109,
        66,
        249,
        116,
        174,
        30
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidAmount",
      "msg": "Amount must be >= minimum order size."
    },
    {
      "code": 6001,
      "name": "invalidDirection",
      "msg": "Invalid direction. Must be 0 (sGOR→gGOR) or 1 (gGOR→sGOR)."
    },
    {
      "code": 6002,
      "name": "invalidMint",
      "msg": "Invalid token mint for this direction."
    },
    {
      "code": 6003,
      "name": "orderExpired",
      "msg": "Order has expired."
    },
    {
      "code": 6004,
      "name": "orderAlreadyFilled",
      "msg": "Order has already been filled."
    },
    {
      "code": 6005,
      "name": "insufficientFunds",
      "msg": "Insufficient funds for swap."
    },
    {
      "code": 6006,
      "name": "unauthorized",
      "msg": "Unauthorized — only the maker can perform this action."
    },
    {
      "code": 6007,
      "name": "expirationInPast",
      "msg": "Expiration slot is in the past."
    },
    {
      "code": 6008,
      "name": "expirationTooFar",
      "msg": "Expiration too far in the future (max ~24 hours)."
    },
    {
      "code": 6009,
      "name": "missingEscrowTokenAccount",
      "msg": "Missing escrow token account (required for SPL direction)."
    },
    {
      "code": 6010,
      "name": "missingMakerTokenAccount",
      "msg": "Missing maker token account (required for SPL direction)."
    },
    {
      "code": 6011,
      "name": "missingTakerTokenAccount",
      "msg": "Missing taker token account."
    },
    {
      "code": 6012,
      "name": "missingTakerReceiveTokenAccount",
      "msg": "Missing taker receive token account."
    },
    {
      "code": 6013,
      "name": "missingMakerReceiveTokenAccount",
      "msg": "Missing maker receive token account."
    }
  ],
  "types": [
    {
      "name": "order",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "maker",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "direction",
            "type": "u8"
          },
          {
            "name": "expirationSlot",
            "type": "u64"
          },
          {
            "name": "isFilled",
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
      "name": "orderCancelled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "orderKey",
            "type": "pubkey"
          },
          {
            "name": "maker",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "direction",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "orderCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "orderKey",
            "type": "pubkey"
          },
          {
            "name": "maker",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "direction",
            "type": "u8"
          },
          {
            "name": "expirationSlot",
            "type": "u64"
          }
        ]
      }
    },
    {
      "name": "orderFilled",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "orderKey",
            "type": "pubkey"
          },
          {
            "name": "maker",
            "type": "pubkey"
          },
          {
            "name": "taker",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "direction",
            "type": "u8"
          }
        ]
      }
    }
  ]
};
