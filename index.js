const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 3000;

// middlewares
app.use(cors());
app.use(express.json());

const uri = process.env.Mongodb_URI;
// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

app.get("/", (req, res) => {
  res.send("Blood Donation Server is Running!");
});

// the run function of mongodb. inside it all the data management is done
async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
    // create the database in mongodb
    const db = client.db("bloodDonation");
    // creating the data collection for the users data under the database "bloodDonation"
    const bloodDonationUsersCollection = db.collection("usersCollection");

    // all the api
    app.get("/users", async (req, res) => {
      const { bloodGroup, district, upazila } = req.query;
      const query = {};
      if (bloodGroup) {
        query.bloodGroup = bloodGroup;
      }
      if (district) {
        query.district = district;
      }
      if (upazila) {
        query.upazila = upazila;
      }

      if (query) {
        // query.role = "donor"
        const result = await bloodDonationUsersCollection.find(query).toArray();
        res.send(result);
      }
    });
    // api to store users data in usersCollection collection
    app.post("/users", async (req, res) => {
      const userData = req.body;
      userData.role = "donor";
      userData.status = "active";
      const result = await bloodDonationUsersCollection.insertOne(userData);
      res.send(result);
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Blood Donation App is Running At Port: `, port);
});
