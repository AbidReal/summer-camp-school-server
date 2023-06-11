const express = require("express");
const app = express();
const cors = request("cors");
const port = process.env.PORT || 5000;

//middleware
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("summer camp martial art server is running");
});
app.listen(port, () => {
  console.log(`Summer Camp School Server is running of port: ${port}`);
});
