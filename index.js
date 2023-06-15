const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);
const port = process.env.PORT || 5000;

//middleware
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "unauthorized access" });
  }
  // bearer token
  const token = authorization.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res
        .status(401)
        .send({ error: true, message: "unauthorized access" });
    }
    req.decoded = decoded;
    next();
  });
};

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.7vnkrh3.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const usersCollection = client.db("schoolMartialArtDB").collection("users");
    const classesCollection = client
      .db("schoolMartialArtDB")
      .collection("classes");
    const pendingClassesCollection = client
      .db("schoolMartialArtDB")
      .collection("pendingClasses");
    const instructorsCollection = client
      .db("schoolMartialArtDB")
      .collection("instructors");
    const selectedClassesCollection = client
      .db("schoolMartialArtDB")
      .collection("selectedClasses");

    app.post("/jwt", async (req, res) => {
      const user = req.body;
      const token = await jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });

      res.send({ token });
    });

    //verify admin middleware
    // Warning: use verifyJWT before using verifyAdmin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "admin") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden message" });
      }
      next();
    };

    //verify instructor
    // Warning: use verifyJWT before using verifyInstructor
    const verifyInstructor = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "instructor") {
        return res
          .status(403)
          .send({ error: true, message: "forbidden message" });
      }
      next();
    };

    //pending classes
    app.get("/pending-classes", async (req, res) => {
      const email = req.query.email; // Get the email from the query parameters
      const filter = email ? { instructorEmail: email } : {}; // Create filter based on email presence

      try {
        const result = await pendingClassesCollection.find(filter).toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching pending classes:", error);
        res.status(500).send("Error fetching pending classes");
      }
    });

    app.post(
      "/pending-classes",
      verifyJWT,
      verifyInstructor,
      async (req, res) => {
        const pendingClass = req.body;
        console.log(pendingClass);
        const result = await pendingClassesCollection.insertOne(pendingClass);
        res.send(result);
      }
    );
    //patch pending classes
    app.patch("/pending-classes/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {};

      if (req.body.status) {
        updateDoc.$set = { status: req.body.status };
      }

      if (req.body.feedback) {
        updateDoc.$set = { feedback: req.body.feedback };
      }

      try {
        const result = await pendingClassesCollection.updateOne(
          filter,
          updateDoc
        );
        res.send(result);
      } catch (error) {
        console.error("Error updating class:", error);
        res.status(500).send("Error updating class");
      }
    });

    //users data
    app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.post("/users", async (req, res) => {
      const user = req.body;
      const query = { email: user.email };
      const existingUser = await usersCollection.findOne(query);
      if (existingUser) {
        return res.send({ message: "user already exists" });
      }
      const result = await usersCollection.insertOne(user);
      res.send(result);
    });

    //get admin
    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ admin: false });
      }

      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { admin: user?.role === "admin" };
      res.send(result);
    });

    //get instructor
    app.get("/users/instructor/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ instructor: false });
      }

      const query = { email: email };
      const user = await usersCollection.findOne(query);
      const result = { instructor: user?.role === "instructor" };
      res.send(result);
    });

    //make admin
    app.patch("/users/admin/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "admin",
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });
    //make instructor
    app.patch("/users/instructor/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: "instructor",
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    //classes page data
    app.get("/classes", async (req, res) => {
      const result = await classesCollection.find().toArray();
      res.send(result);
    });

    //classes post

    app.post("/classes", async (req, res) => {
      const item = req.body;
      // console.log(item);
      const result = await classesCollection.insertOne(item);
      res.send(result);
    });

    //instructors page data
    app.get("/instructors", async (req, res) => {
      const result = await instructorsCollection.find().toArray();
      res.send(result);
    });

    //selected Classes of cart collection
    app.get("/selected-classes", verifyJWT, async (req, res) => {
      const email = req.query.email;
      // console.log(email);
      if (!email) {
        res.send([]);
      }

      const decodedEmail = req.decoded.email;
      if (email !== decodedEmail) {
        return res
          .status(403)
          .send({ error: true, message: "forbidden access" });
      }
      const query = { email: email };
      const result = await selectedClassesCollection.find(query).toArray();
      res.send(result);
    });
    app.post("/selected-classes", async (req, res) => {
      const item = req.body;
      // console.log(item);
      const result = await selectedClassesCollection.insertOne(item);
      res.send(result);
    });

    app.delete("/selected-classes/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await selectedClassesCollection.deleteOne(query);
      res.send(result);
    });

    //create payment intent
    app.post("/create-payment-intent", async (req, res) => {
      const { price } = req.body;
      const amount = price * 100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "usd",
        payment_method_types: [card],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("summer camp martial art server is running");
});
app.listen(port, () => {
  console.log(`Summer Camp School Server is running of port: ${port}`);
});
