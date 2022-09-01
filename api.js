import cors from "cors";
import dayjs from "dayjs";
import express from "express";
const app = express();
app.use(cors());
app.use(express.json());

let users = [];
let messages = [];
app.post("/participants", (req, res) => {
  const { name } = req.body;

  if (!name) return res.sendStatus(422);

  const userExists = users.find((user) => user.name === name);
  if (userExists) return res.sendStatus(409);

  users.push({ name, lastStatus: Date.now() });
  messages.push({
    from: name,
    to: "Todos",
    text: "Entra na sala...",
    type: "status",
    time: dayjs(Date.now()).format("HH:mm:ss"),
  });
  console.log(users);
  console.log(messages);
  res.sendStatus(201);
});
app.get("/participants", (req, res) => {
  res.status(200).send(users);
});
app.post("/messages", (req, res) => {
  const { to, text, type } = req.body;
  const name = req.get("user") ?? "";
  const userExists = users.find((user) => user.name === name);

  if (
    !(typeof to === "string" || to) ||
    !(typeof text || text) ||
    !(type === "message" || type === "private_message") ||
    !userExists
  ) {
    return res.sendStatus(422);
  }

  messages.unshift({
    from: name,
    ...req.body,
    time: dayjs(Date.now()).format("HH:mm:ss"),
  });
  return res.sendStatus(201);
});

app.get("/messages", (req, res) => {
  const { limit } = req.query;
  const name = req.get("User") ?? "";
  const userMessages = messages.filter((message) => message.from === name);
  const messageLimit = limit ? parseInt(limit, 10) : userMessages.length;
  return res.status(200).send(userMessages.splice(messageLimit * -1));
});

app.status("/status");
app.listen(5000, () => {
  console.log("Listening from port 5000");
});
