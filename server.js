const express = require("express");
const app = express();
const http = require("http").Server(app);
const sio = require("socket.io")(http);
const fs = require("fs");
const bodyParser = require("body-parser");
const Hyperdrive = require("hyperdrive");
const pump = require("pump");
const pubsub = require("./hyperpubsub.js")("chakrachain");

const key = Buffer.from(
  process.env.HYPERDRIVEKEY||"09b580a5a97b529364040a601b0ceb3b2ba539a884d0037753823c3557395a51",
  "hex"
);
const hyperswarm = require("hyperswarm");

global.drive = new Hyperdrive("./state", key);
global.drive.ready(() => {
  const swarm = hyperswarm();
  swarm.on("connection", (connection, info) => {
    pump(
      connection,
      global.drive.replicate({ initiator: info.client }),
      connection
    );
  });
  swarm.join(global.drive.discoveryKey, {
    announce: true,
    lookup: true
  });
});

const io = require("./hyperdrivestorage.js");
const crypto = require("crypto");
const getId = topic => {
  return crypto
    .createHash("sha256")
    .update(topic || new Date().getTime().toString())
    .digest();
};

process.on("SIGINT", () => swarm.destroy());

app.use(bodyParser.json());
app.use(express.static("public"));
const sockets = {};
String.prototype.replaceAll = function(search, replacement) {
  var target = this;
  return target.replace(new RegExp(search, "g"), replacement);
};

sio.on("connection", function(socket) {
  try {
    console.log("A user connected");
    sockets[socket.id] = socket;
    const watches = [];

    socket.on("subscribe", function(path) {
      console.log("subscribe", path);
      const watch = global.drive.watch("/" + path.replaceAll("-", "/"), () => {
        console.log("drive update", path);
        socket.emit("update-" + path, path);
      });
      watches.push(watch);
    });
    socket.on("disconnect", function() {
      console.log("A user disconnected");
      for (let watch of watches) watch.destroy();
      delete sockets[socket.id];
    });
  } catch (e) {
    delete sockets[socket.id];
  }
});

const ROOT_TOKEN = "C";
const contractPath = "contracts-0ebd8087442a81030913fe9a9177834a4f1091809e890e50de2ff0cc525e1a56";

app.get("/pools", async (req, res) => {
  const pools = [];
  for (let file of await io.ls(`${contractPath}-pool`)) {
    const token = await io.read(`${contractPath}-tokens-${file}`);
    const pool = await io.read(`${contractPath}-pool-${file}`);
    let poolbalance1 = parseFloat(pool[token.symbol]);
    let poolbalance2 = parseFloat(pool[ROOT_TOKEN]);
    let ratio = poolbalance2 / poolbalance1;
    if (poolbalance1 > 0 && poolbalance2 > 0) {
      pools.push({ name: file, ratio, pool, token });
    }
  }
  const ret = pools.sort((a, b) => {
    return b.pool[ROOT_TOKEN] - a.pool[ROOT_TOKEN];
  });
  return res.send(JSON.stringify(ret));
});

app.get("/ls", async (req, res) => {
  const ret = await io.ls(req.query.path);
  return res.send(JSON.stringify(ret));
});

app.get("/get", async (req, res) => {
  const ret = await io.read(req.query.path);
  return res.send(JSON.stringify(ret));
});

app.post("/transfer", async (req, res) => {
  const body = req.body;
  const out = {
    tx: Buffer.from(req.body.data, "hex").toString("binary"),
    pk: req.body.publicKey
  };
  console.log(out);
  pubsub.emit("tx", out);
  //ipfs.pubsub.publish("chakrachain-transactions", packr.pack(body));
  return res.send(
    JSON.stringify({ response: "POST HTTP method on user resource" })
  );
});

const listener = app.listen(process.env.PORT, () => {
  console.log("Your app is listening on port " + listener.address().port);
});
var socketio = sio.listen(listener);
