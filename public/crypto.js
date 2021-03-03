window.sign = nacl.sign;
window.ROOT_TOKEN = 'C';
window.packr = msgpackr;
const { Buffer } = buffer;

window.lsign = (obj, key) => {
  const keyUint8Array = new Uint8Array(Buffer.from(key, "hex"));
  const packed = packr.pack(obj);
  const messageUint8 = new Uint8Array(packed);
  const box = sign(messageUint8, keyUint8Array);
  return box;
};

window.lverify = (msg, key) => {
  if (msg == null) throw new Error("Cannot verify null message");
  if (key == null) throw new Error("Cannot verify null key");
  const keyUint8Array = new Uint8Array(Buffer.from(key, "hex"));
  const messageAsUint8Array = msg;
  const outputUint8Array = sign.open(messageAsUint8Array, keyUint8Array);
  if (!outputUint8Array) throw new Error("Couldnt unpack data with key:", key);
  return packr.unpack(outputUint8Array);
};



window.transact = (action, payload)=>{
  var xhr = new XMLHttpRequest();
  var url = "transfer";
  xhr.open("POST", url, true);
  xhr.setRequestHeader("Content-Type", "application/json");
  xhr.onreadystatechange = function() {
    if (xhr.readyState === 4 && xhr.status === 200) {
      var json = JSON.parse(xhr.responseText);
      console.log(json.email + ", " + json.password);
    }
  };
  const data = JSON.stringify({
    data: buffer.Buffer.from(lsign({ contract: '0ebd8087442a81030913fe9a9177834a4f1091809e890e50de2ff0cc525e1a56', action, payload, id:new Date().getTime()}, keyPair.secretKey)).toString("hex"),
    publicKey: keyPair.publicKey
  });
  xhr.send(data);
}

//ls?path=/contracts/0ebd8087442a81030913fe9a9177834a4f1091809e890e50de2ff0cc525e1a56/accounts/dc295a4ecff3359b2d54fc3280c1cc9c12553ca605ba90bc6c778bd4c21c07bb

