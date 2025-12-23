const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const app = express();
const port = process.env.PORT || 3000;

const admin = require("firebase-admin");

// const serviceAccount = require("./red-help-blood-donation-firebase-admin-sdk.json");

const decoded = Buffer.from(process.env.FB_SERVICE_KEY, "base64").toString(
  "utf8"
);
const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// middlewares
app.use(cors());
app.use(express.json());

const verifyToken = async (req, res, next) => {
  if (!req.headers.authorization) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  const token = req.headers.authorization.split(" ")[1];
  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }
  try {
    const userInfo = await admin.auth().verifyIdToken(token);
    req.token_owner = userInfo.email;
    next();
  } catch {
    return res.status(401).send({ message: "unauthorized access" });
  }
};

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
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
    // create the database in mongodb
    const db = client.db("bloodDonation");
    // creating the data collection for the users data under the database "bloodDonation"
    const bloodDonationUsersCollection = db.collection("usersCollection");
    // creating the data collection for all donation requests
    const donationRequestsCollection = db.collection(
      "donationRequestsCollection"
    );

    // admin verification middleware
    const verifyAdmin = async (req, res, next) => {
      const email = req.token_owner;
      const query = { email };
      const user = await bloodDonationUsersCollection.findOne(query);
      if (!user || user.role !== "admin") {
        return res.status(403).send({ message: "Forbidden Access" });
      }
      next();
    };
    // volunteer verification middleware
    const verifyVolunteer = async (req, res, next) => {
      const email = req.token_owner;
      const query = { email };
      const user = await bloodDonationUsersCollection.findOne(query);
      if (!user || (user.role !== "volunteer" && user.role !== "admin")) {
        return res.status(403).send({ message: "Forbidden Access" });
      }
      next();
    };

    // all the api

    // api to get all the requests admin
    app.get(
      "/all-donation-requests",
      verifyToken,
      verifyVolunteer,
      async (req, res) => {
        const email = req.query.email;
        if (email === req.token_owner) {
          const query = {};
          const status = req.query.status;
          if (status) {
            query.donationStatus = status;
          }
          const result = await donationRequestsCollection.find(query).toArray();
          res.send(result);
        }
      }
    );
    // api to get all users without the super admin by admin only
    app.get("/all-users-data", verifyToken, verifyAdmin, async (req, res) => {
      const email = req.query.email;
      if (email === req.token_owner) {
        const query = { email: { $ne: "merajuljim1971@gmail.com" } };
        const status = req.query.status;
        if (status) {
          query.status = status;
        }
        const result = await bloodDonationUsersCollection.find(query).toArray();
        res.send(result);
      }
    });

    // api to get request details
    app.get("/request/:id/details", verifyToken, async (req, res) => {
      const email = req.query.email;
      if (email === req.token_owner) {
        const Id = req.params.id;
        const id = new ObjectId(Id);
        const query = { _id: id };
        const result = await donationRequestsCollection.findOne(query);
        res.send(result);
      }
    });

    // api to get own recent 3 donation requests data
    app.get("/my-recent-requests", verifyToken, async (req, res) => {
      const email = req.token_owner;
      const query = { requesterEmail: email };
      const result = await donationRequestsCollection
        .find(query)
        .sort({ createdAt: -1 })
        .limit(3)
        .toArray();
      res.send(result);
    });

    // api to get own all donation requests data
    app.get("/my-donation-requests", verifyToken, async (req, res) => {
      const email = req.token_owner;
      const query = { requesterEmail: email };
      const result = await donationRequestsCollection
        .find(query)
        .sort({ createdAt: -1 })
        .toArray();
      res.send(result);
    });

    // api tpo get role
    app.get("/role", verifyToken, async (req, res) => {
      const email = req.query.email;
      if (email !== req.token_owner) {
        res.status(403).send({ message: "forbidden access" });
      }
      const query = { email };
      const result = await bloodDonationUsersCollection.findOne(query);
      res.send(result);
    });
    // api to get user status
    app.get("/user-status", verifyToken, async (req, res) => {
      const email = req.query.email;
      if (email === req.token_owner) {
        const query = { email };
        const options = { _id: 0, status: 1 };
        const result = await bloodDonationUsersCollection.findOne(query);
        res.send(result.status);
      }
    });
    // api to get user data
    app.get("/users-public", async (req, res) => {
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

      const options = { _id: 0, name: 1, email: 1 };

      if (query) {
        // query.role = "donor"
        const result = await bloodDonationUsersCollection
          .find(query)
          .project(options)
          .toArray();
        res.send(result);
      }
    });
    app.get("/requests-public", async (req, res) => {
      const options = {
        recipientName: 1,
        recipientDistrict: 1,
        recipientUpazila: 1,
        bloodGroup: 1,
        donationDate: 1,
        donationTime: 1,
      };
      const result = await donationRequestsCollection
        .find({ donationStatus: "pending" })
        .project(options)
        .toArray();
      res.send(result);
    });
    // api to get requests number
    app.get("/requests-number", verifyToken, async (req, res) => {
      const email = req.query.email;
      if (email === req.token_owner) {
        const query = {};
        const result = await donationRequestsCollection.countDocuments(query);
        res.send(result);
      }
     res.status(403).send({ message: "Forbidden Access!" });
    });
    // api to get user number
    app.get("/users-number", verifyToken, async (req, res) => {
      const email = req.query.email;
      if (email === req.token_owner) {
        const query = { role: "donor" };
        const result = await bloodDonationUsersCollection.countDocuments(query);
        res.send(result);
      }
      if (email !== req.token_owner) {
        res.status(403).send({ message: "Forbidden Access!" });
      }
    });
    // api to get users own data
    app.get("/user", verifyToken, async (req, res) => {
      const email = req.token_owner;
      if (email === req.query.email) {
        const query = { email };
        const result = await bloodDonationUsersCollection.findOne(query);
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
    // api to store data of donation requests
    app.post("/create-donation-request", verifyToken, async (req, res) => {
      const email = req.token_owner;
      if (email === req.body.requesterEmail) {
        req.body.donationStatus = "pending";
        req.body.createdAt = new Date();
        const newRequest = req.body;
        const result = await donationRequestsCollection.insertOne(newRequest);
        res.send(result);
      }
    });
    // api to update inprogress to done or canceled status
    app.patch("/update/:id/progress", verifyToken, async (req, res) => {
      const email = req.query.email;
      if (email === req.token_owner) {
        const Id = req.params.id;
        const { status } = req.body;
        const id = new ObjectId(Id);
        const filter = { _id: id };
        const updatedDoc = { $set: { donationStatus: status } };
        const result = await donationRequestsCollection.updateOne(
          filter,
          updatedDoc
        );
        res.send(result);
      } else {
        return res.status(403).send({ message: "Forbidden Access" });
      }
    });
    // api to update donation data from dashboard update page
    app.patch("/update/:id/request-data", verifyToken, async (req, res) => {
      const email = req.query.email;
      if (email === req.token_owner) {
        const Id = req.params.id;
        const id = new ObjectId(Id);
        const filter = { _id: id };
        const updatedDoc = { $set: req.body };
        const result = await donationRequestsCollection.updateOne(
          filter,
          updatedDoc
        );
        res.send(result);
      }
    });
    // api to update a donation request data when donor donate
    app.patch("/update/:id", verifyToken, async (req, res) => {
      if (req.body.donorEmail === req.token_owner) {
        const Id = req.params.id;
        const id = new ObjectId(Id);
        const query = { _id: id };
        const { donorEmail, donorName } = req.body;
        const updatedDoc = {
          $set: { donorName, donorEmail, donationStatus: "inprogress" },
        };
        const result = await donationRequestsCollection.updateOne(
          query,
          updatedDoc
        );
        res.send(result);
      } else {
        return res.status(403).send({ message: "Forbidden Access" });
      }
    });
    // api to manage user role by admin only
    app.patch(
      "/user/:email/update",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        const email = req.query.email;
        if (email === req.token_owner) {
          const role = req.query.role;
          const userEmail = req.params.email;
          const filter = { email: userEmail };
          const updatedDoc = { $set: { role } };
          const result = await bloodDonationUsersCollection.updateOne(
            filter,
            updatedDoc
          );
          return res.send(result);
        }
      }
    );
    // api to update user status by admin only
    app.patch("/user/:email", verifyToken, verifyAdmin, async (req, res) => {
      const email = req.query.email;
      if (email === req.token_owner) {
        const userEmail = req.params.email;
        const status = req.query.status;
        const filter = { email: userEmail };
        const updatedDoc = { $set: { status } };
        const result = await bloodDonationUsersCollection.updateOne(
          filter,
          updatedDoc
        );
        res.send(result);
      }
    });
    // api to update user data
    app.patch("/user", verifyToken, async (req, res) => {
      const email = req.query.email;
      if (email === req.token_owner) {
        const filter = { email };
        const updatedDoc = { $set: req.body };
        const result = await bloodDonationUsersCollection.updateOne(
          filter,
          updatedDoc
        );
        res.send(result);
      }
    });
    // api to delete object
    app.delete("/delete/:id", verifyToken, async (req, res) => {
      const email = req.query.email;
      if (email === req.token_owner) {
        const Id = req.params.id;
        const id = new ObjectId(Id);
        const query = { _id: id };
        const result = await donationRequestsCollection.deleteOne(query);
        res.send(result);
      }
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
