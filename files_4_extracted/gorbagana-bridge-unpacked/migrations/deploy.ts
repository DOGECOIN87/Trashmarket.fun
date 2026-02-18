// Anchor migration/deploy script
const anchor = require("@coral-xyz/anchor");

module.exports = async function (provider: any) {
  anchor.setProvider(provider);
  console.log("Deployed to:", provider.connection.rpcEndpoint);
};
