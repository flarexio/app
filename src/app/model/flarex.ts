/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/flarex.json`.
 */
export type Flarex = {
  "address": "fx72MZ7SPxwePzFiMagFZakeXxaJn7oLGDd3wxLuENL",
  "metadata": {
    "name": "flarex",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Created with Anchor"
  },
  "instructions": [
    {
      "name": "addEdge",
      "discriminator": [
        244,
        46,
        8,
        33,
        230,
        159,
        6,
        244
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "collection"
          ]
        },
        {
          "name": "edge",
          "writable": true
        },
        {
          "name": "collection",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "id",
          "type": {
            "array": [
              "u8",
              16
            ]
          }
        },
        {
          "name": "name",
          "type": "string"
        },
        {
          "name": "edge",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "clearCollection",
      "discriminator": [
        76,
        110,
        14,
        211,
        42,
        225,
        76,
        91
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true,
          "relations": [
            "collection"
          ]
        },
        {
          "name": "collection",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "expandCollection",
      "discriminator": [
        222,
        196,
        186,
        127,
        183,
        36,
        154,
        183
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "collection",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "capacity",
          "type": "u32"
        }
      ]
    },
    {
      "name": "initialize",
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "collection",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "capacity",
          "type": "u32"
        }
      ]
    },
    {
      "name": "resetNatsAccount",
      "discriminator": [
        99,
        199,
        100,
        222,
        8,
        191,
        173,
        83
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "account",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "capacity",
          "type": "u32"
        }
      ]
    },
    {
      "name": "setupNatsAccount",
      "discriminator": [
        207,
        48,
        97,
        233,
        130,
        133,
        23,
        134
      ],
      "accounts": [
        {
          "name": "authority",
          "writable": true,
          "signer": true
        },
        {
          "name": "account",
          "writable": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "updateEdge",
      "discriminator": [
        99,
        164,
        173,
        98,
        171,
        115,
        227,
        178
      ],
      "accounts": [
        {
          "name": "authority",
          "signer": true,
          "relations": [
            "edge"
          ]
        },
        {
          "name": "edge",
          "writable": true
        }
      ],
      "args": [
        {
          "name": "id",
          "type": {
            "array": [
              "u8",
              16
            ]
          }
        },
        {
          "name": "edge",
          "type": {
            "defined": {
              "name": "edge"
            }
          }
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "edge",
      "discriminator": [
        14,
        2,
        21,
        11,
        215,
        231,
        136,
        24
      ]
    },
    {
      "name": "edgeCollection",
      "discriminator": [
        30,
        86,
        115,
        70,
        134,
        111,
        255,
        28
      ]
    },
    {
      "name": "natsAccount",
      "discriminator": [
        110,
        65,
        90,
        108,
        209,
        79,
        99,
        148
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "newSizeTooSmall",
      "msg": "New size must be greater than the original capacity."
    },
    {
      "code": 6001,
      "name": "edgeCollectionFull",
      "msg": "The edge collection is full."
    },
    {
      "code": 6002,
      "name": "nameTooLong",
      "msg": "The name cannot exceed 100 bytes."
    }
  ],
  "types": [
    {
      "name": "accountLimits",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "imports",
            "type": "i64"
          },
          {
            "name": "exports",
            "type": "i64"
          },
          {
            "name": "wildcard",
            "type": "bool"
          },
          {
            "name": "disallowBearer",
            "type": "bool"
          },
          {
            "name": "conn",
            "type": "i64"
          },
          {
            "name": "leaf",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "edge",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "metadata",
            "type": {
              "defined": {
                "name": "metadata"
              }
            }
          },
          {
            "name": "id",
            "type": {
              "array": [
                "u8",
                16
              ]
            }
          },
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "edge",
            "type": "pubkey"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "edgeCollection",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "metadata",
            "type": {
              "defined": {
                "name": "metadata"
              }
            }
          },
          {
            "name": "edges",
            "type": {
              "vec": {
                "array": [
                  "u8",
                  16
                ]
              }
            }
          },
          {
            "name": "capacity",
            "type": "u32"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "jetStreamLimits",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "memStorage",
            "type": "i64"
          },
          {
            "name": "diskStorage",
            "type": "i64"
          },
          {
            "name": "streams",
            "type": "i64"
          },
          {
            "name": "consumer",
            "type": "i64"
          },
          {
            "name": "maxAckPending",
            "type": "i64"
          },
          {
            "name": "memMaxStreamBytes",
            "type": "i64"
          },
          {
            "name": "diskMaxStreamBytes",
            "type": "i64"
          },
          {
            "name": "maxBytesRequired",
            "type": "bool"
          }
        ]
      }
    },
    {
      "name": "metadata",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "edge",
            "fields": [
              "u8"
            ]
          },
          {
            "name": "edgeCollection",
            "fields": [
              "u8"
            ]
          },
          {
            "name": "natsAccount",
            "fields": [
              "u8"
            ]
          }
        ]
      }
    },
    {
      "name": "natsAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "metadata",
            "type": {
              "defined": {
                "name": "metadata"
              }
            }
          },
          {
            "name": "limits",
            "type": {
              "defined": {
                "name": "operatorLimits"
              }
            }
          },
          {
            "name": "revocations",
            "type": {
              "vec": {
                "defined": {
                  "name": "revocationEntry"
                }
              }
            }
          },
          {
            "name": "capacity",
            "type": "u32"
          },
          {
            "name": "authority",
            "type": "pubkey"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "natsLimits",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "subs",
            "type": "i64"
          },
          {
            "name": "data",
            "type": "i64"
          },
          {
            "name": "payload",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "operatorLimits",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "natsLimits",
            "type": {
              "defined": {
                "name": "natsLimits"
              }
            }
          },
          {
            "name": "accountLimits",
            "type": {
              "defined": {
                "name": "accountLimits"
              }
            }
          },
          {
            "name": "jetstreamLimits",
            "type": {
              "defined": {
                "name": "jetStreamLimits"
              }
            }
          }
        ]
      }
    },
    {
      "name": "revocationEntry",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "user",
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "type": "i64"
          },
          {
            "name": "all",
            "type": "bool"
          }
        ]
      }
    }
  ]
};

