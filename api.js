import cors from "cors";
import dayjs from "dayjs";
import express from "express";
import joi from "joi";
import dotenv from "dotenv";
import { MongoClient, ObjectId } from "mongodb";

//#region Backend Configuration
const app = express();
app.use(cors());
app.use(express.json());
dotenv.config();
let db;
const mongoClient = new MongoClient(process.env.MONGO_URI);
mongoClient.connect().then(() => (db = mongoClient.db("test")));
//#endregion

//#region Schemas
const participantSchema = joi.object({
  name: joi.string().required(),
});
const messageSchema = joi.object({
  to: joi.string().required(),
  text: joi.string().required(),
  type: joi.string().valid("message", "private_message").required(),
});
//#endregion

//#region Endpoints
app.post("/participants", async (req, res) => {
  const { name } = req.body;
  const validation = participantSchema.validate(req.body);
  const collectionLength = await db
    .collection("messages")
    .estimatedDocumentCount();
  //#region FastFail
  if (validation.error) return res.sendStatus(422);
  const userExists = await db
    .collection("participants")
    .findOne({ name: name });
  if (userExists) return res.sendStatus(409);
  //#endregion

  //#region Sending data to collections
  try {
    await db.collection("participants").insertOne({
      name,
      lastStatus: Date.now(),
    });
    await db.collection("messages").insertOne({
      messageId: collectionLength + 1,
      from: name,
      to: "Todos",
      text: "Entra na sala...",
      type: "status",
      time: dayjs(Date.now()).format("HH:mm:ss"),
    });
    return res.sendStatus(201);
  } catch (error) {
    console.log(error);
  }
  //#endregion
});
app.get("/participants", async (req, res) => {
  //#region Getting data from collection
  try {
    const response = await db.collection("participants").find().toArray();
    return res.status(200).send(response);
  } catch (error) {
    console.log(error);
  }
  //#endregion
});
app.post("/messages", async (req, res) => {
  const name = req.get("User") ?? "";
  const userExists = await db
    .collection("participants")
    .findOne({ name: name });
  const validation = messageSchema.validate(req.body);
  const collectionLength = await db
    .collection("messages")
    .estimatedDocumentCount();
  //#region FastFail
  if (!userExists) return res.sendStatus(422);
  if (validation.error) return res.status(422).send(validation.error.message);
  //#endregion

  //#region Sending data to Messages Collection
  try {
    await db.collection("messages").insertOne({
      messageId: collectionLength + 1,
      from: name,
      ...req.body,
      time: dayjs(Date.now()).format("HH:mm:ss"),
    });
    return res.sendStatus(201);
  } catch (error) {
    console.log(error);
  }
  //#endregion
});
app.get("/messages", async (req, res) => {
  const { limit } = req.query;
  const name = req.get("User") ?? "";

  //#region Getting data from messages collection
  try {
    const messages = await db
      .collection("messages")
      .find()
      .sort({ messageId: 1 })
      .toArray();
    const userMessages = messages.filter(
      (message) => message.to === name || message.to === "Todos"
    );
    const messageLimit = limit ? parseInt(limit, 10) : userMessages.length;
    return res.status(200).send(userMessages.splice(messageLimit * -1));
  } catch (error) {
    console.log(error);
  }
  //#endregion
});
app.post("/status", async (req, res) => {
  const name = req.get("User") ?? "";
  const userExists = await db
    .collection("participants")
    .findOne({ name: name });
  console.log(userExists);
  //#region FastFail
  if (!userExists) return res.sendStatus(404);
  //#endregion

  //#region Updating data from Participants Collections
  try {
    const updateDoc = {
      $set: {
        lastStatus: Date.now(),
      },
    };
    await db
      .collection("participants")
      .updateOne({ name: name, lastStatus: userExists.lastStatus }, updateDoc);
    return res.sendStatus(200);
  } catch (error) {
    console.log(error);
  }
  //#endregion
});
//#region Bonus
app.delete("/messages/:messageId", async (req, res) => {
  const name = req.get("User") ?? "";
  const { messageId } = req.params;

  //#region Deleting user message
  try {
    const deletedMessage = await db
      .collection("messages")
      .deleteOne({ _id: ObjectId(messageId), from: name });
    return deletedMessage.deletedCount === 0
      ? res.sendStatus(401)
      : res.sendStatus(204);
  } catch (error) {
    console.log(error);
  }
  res.sendStatus(404);
  //#endregion
});
app.put("/messages/:messageId", async (req, res) => {
  const name = req.get("User") ?? "";
  const { to, text, type } = req.body;
  const validation = messageSchema.validate(req.body);
  const { messageId } = req.params;
  const userExists = await db
    .collection("participants")
    .findOne({ name: name });
  //#region Fastfail
  if (!userExists) return res.sendStatus(422);
  if (validation.error || !userExists)
    return res.status(422).send(validation.error.message);
  //#endregion

  //#region updating user message
  try {
    const updateDoc = {
      $set: {
        to: to,
        text: text,
        type: type,
      },
    };
    const updatedMessage = await db
      .collection("messages")
      .updateOne({ _id: ObjectId(messageId), from: name }, updateDoc);
    updatedMessage.matchedCount === 0
      ? res.sendStatus(404)
      : res.sendStatus(200);
  } catch (error) {
    console.log(error);
  }
  //#endregion
});

//#endregion Bonus

//#endregion Endpoints

//#region Removing inactive participants
async function removeInactiveUsers() {
  const now = Date.now();
  const collectionLength = await db
    .collection("messages")
    .estimatedDocumentCount();
  try {
    const users = await db.collection("participants").find().toArray();
    const inactiveUsers = users.filter(
      (users) => (now - users.lastStatus) / 1000 > 10
    );
    inactiveUsers.map((user) => {
      db.collection("messages").insertOne({
        messageId: collectionLength + 1,
        from: user.name,
        to: "Todos",
        text: "sai da sala...",
        type: "status",
        time: dayjs(Date.now()).format("HH:mm:ss"),
      });
      db.collection("participants").deleteOne({
        name: user.name,
      });
    });
  } catch (error) {
    console.log(error);
  }
}

setInterval(() => removeInactiveUsers(), 15000);

//#endregion

app.listen(5000, () => {
  console.log("Listening from port 5000");
});
