const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');
const jwt = require('jsonwebtoken')
const nodemailer = require('nodemailer');
require('dotenv').config();
const cookieParser = require('cookie-parser');

const app = express();
const port = process.env.PORT || 5000;

// Middleware
const allowedOrigins = [
  'https://alphaoneedu.com',
  'https://sso.alphaoneedu.com'
];

// CORS middleware with dynamic options
const corsOptionsDelegate = function (req, callback) {
  let corsOptions;

  // Check if the origin is in the allowedOrigins list
  if (allowedOrigins.includes(req.header('Origin'))) {
    corsOptions = {
      origin: req.header('Origin'), // Allow requests from the allowed origins
      credentials: true,            // Allow cookies and credentials to be sent
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], // Specify allowed methods
      allowedHeaders: ['Content-Type', 'Authorization'], // Specify allowed headers
    };
  } else {
    corsOptions = { origin: false }; // Block requests from disallowed origins
  }

  callback(null, corsOptions); // Pass the options to CORS middleware
};

app.use(cors(corsOptionsDelegate));



app.use(express.json());
app.use(cookieParser())

const dbuser = process.env.DB_USER;
const key = process.env.DB_PASS;

const uri = `mongodb+srv://${dbuser}:${key}@cluster0.ritix.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});


const transporter = nodemailer.createTransport({
  service: 'gmail', // Use your email service (e.g., Gmail)
  host: "smtp.ethereal.email",
  port: 587,
  secure: false,
  auth: {
    user: process.env.SENDER_EMAIL, // Your email address
    pass: process.env.SENDER_PASS, // Your email password or app-specific password
  },
});


const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) {
    return res.status(401).send({ message: 'Not authorized' });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: 'Not authorized' });
    }
    // console.log(req.user)
    req.user = decoded; // Assign the decoded token to req.user for later use
    next(); // Proceed only if the token is valid
  });
};


// Connect to MongoDB
async function run() {



  try {

    // await client.connect();
    // console.log("Connected to MongoDB!");

    const database = client.db("formresponses");
    const consultationsCollection = database.collection("freeConsultation");
    const messagesCollection = database.collection("contactsendmessage");
    const appliedCollection = database.collection("applied");
    const allNotice = database.collection("notices");



    app.post('/jwt', async (req, res) => {
      const user = req.body;
      // console.log(user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
      res
        .cookie('token', token, {
          httpOnly: true,
          secure: true,
          sameSite: 'None',
        })
        .send({ Success: true })
    })

    app.post('/logout', (req, res) => {
      // Clear the token cookie
      res.clearCookie('token', {
        httpOnly: true,  // Ensures the cookie is only sent over HTTP(S), not client JavaScript
        secure: true   // Set to true in production for HTTPS
      });
      res.send({ message: 'Logged out successfully' });
    });



    app.post('/freeConsultation', async (req, res) => {
      const formData = req.body;
      try {
        const result = await consultationsCollection.insertOne(formData);
        res.status(200).json({ message: 'Form submitted successfully!', data: result });
      } catch (error) {
        console.error('Error saving form data:', error);
        res.status(500).json({ message: 'Error saving form data', error });
      }
    });

    app.get('/freeConsultation', verifyToken, async (req, res) => {
      try {
        const consultations = await consultationsCollection.find().toArray();
        res.status(200).json(consultations);
      } catch (error) {
        console.error('Error retrieving consultations:', error);
        res.status(500).json({ message: 'Error retrieving consultations', error });
      }
    });


    app.get('/freeConsultation/:id', verifyToken, async (req, res) => {
      const { id } = req.params;

      try {
        const message = await consultationsCollection.findOne({ _id: new ObjectId(id) });
        if (message) {
          res.status(200).json(message);
        } else {
          res.status(404).json({ message: 'Message not found' });
        }
      } catch (error) {
        console.error('Error retrieving message:', error);
        res.status(500).json({ message: 'Error retrieving message', error });
      }
    });

    app.put('/freeConsultation/:id', async (req, res) => {
      const { id } = req.params;
      const { status } = req.body;

      try {
        const result = await consultationsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status: status } }
        );

        if (result.modifiedCount > 0) {
          res.status(200).json({ message: 'Status updated successfully!' });
        } else {
          res.status(404).json({ message: 'Message not found or status not changed.' });
        }
      } catch (error) {
        console.error('Error updating status:', error);
        res.status(500).json({ message: 'Error updating status', error });
      }
    });

    app.delete('/freeConsultation/:id', verifyToken, async (req, res) => {
      const { id } = req.params;

      try {
        const result = await consultationsCollection.deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount > 0) {
          res.status(200).json({ message: 'Consultation deleted successfully!' });
        } else {
          res.status(404).json({ message: 'Consultation not found' });
        }
      } catch (error) {
        console.error('Error deleting consultation:', error);
        res.status(500).json({ message: 'Error deleting consultation', error });
      }
    });



    app.post('/contactsendmessage', async (req, res) => {
      const formData = req.body;
      try {
        const result = await messagesCollection.insertOne(formData);
        res.status(200).json({ message: 'Form submitted successfully!', data: result });
      } catch (error) {
        console.error('Error saving form data:', error);
        res.status(500).json({ message: 'Error saving form data', error });
      }
    });

    app.get('/contactsendmessage', verifyToken, async (req, res) => {
      try {
        const contactSendMessageResponse = await messagesCollection.find().toArray();
        res.status(200).json(contactSendMessageResponse);
      } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'Error:', error });
      }
    });

    app.get('/contactsendmessage/:id', verifyToken, async (req, res) => {
      const { id } = req.params;

      try {
        const message = await messagesCollection.findOne({ _id: new ObjectId(id) });
        if (message) {
          res.status(200).json(message);
        } else {
          res.status(404).json({ message: 'Message not found' });
        }
      } catch (error) {
        console.error('Error retrieving message:', error);
        res.status(500).json({ message: 'Error retrieving message', error });
      }
    });

    // Add this inside your run function after the GET routes
    app.put('/contactsendmessage/:id', async (req, res) => {
      const { id } = req.params;
      const { status } = req.body;

      try {
        const result = await messagesCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status: status } }
        );

        if (result.modifiedCount > 0) {
          res.status(200).json({ message: 'Status updated successfully!' });
        } else {
          res.status(404).json({ message: 'Message not found or status not changed.' });
        }
      } catch (error) {
        console.error('Error updating status:', error);
        res.status(500).json({ message: 'Error updating status', error });
      }
    });

    app.delete('/contactsendmessage/:id', verifyToken, async (req, res) => {
      const { id } = req.params;

      try {
        const result = await messagesCollection.deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount > 0) {
          res.status(200).json({ message: 'Message deleted successfully!' });
        } else {
          res.status(404).json({ message: 'Message not found' });
        }
      } catch (error) {
        console.error('Error deleting message:', error);
        res.status(500).json({ message: 'Error deleting message', error });
      }
    });



    app.post('/applied', async (req, res) => {
      const formData = req.body;
      try {
        const result = await appliedCollection.insertOne(formData);
        res.status(200).json({ message: 'Form submitted successfully!', data: result });
      } catch (error) {
        console.error('Error saving form data:', error);
        res.status(500).json({ message: 'Error saving form data', error });
      }
    });


    app.get('/applied', verifyToken, async (req, res) => {
      try {
        const appliedFormResponse = await appliedCollection.find().toArray();
        res.status(200).json(appliedFormResponse);
      } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'Error:', error });
      }
    });


    app.get('/applied/:id', verifyToken, async (req, res) => {
      const { id } = req.params;

      try {
        const message = await appliedCollection.findOne({ _id: new ObjectId(id) });
        if (message) {
          res.status(200).json(message);
        } else {
          res.status(404).json({ message: 'Nothing Found' });
        }
      } catch (error) {
        console.error('Error retrieving data:', error);
        res.status(500).json({ message: 'Error retrieving data', error });
      }
    });

    app.put('/applied/:id', async (req, res) => {
      const { id } = req.params;
      const { status } = req.body;

      try {
        const result = await appliedCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: { status: status } }
        );

        if (result.modifiedCount > 0) {
          res.status(200).json({ message: 'Status updated successfully!' });
        } else {
          res.status(404).json({ message: 'Message not found or status not changed.' });
        }
      } catch (error) {
        console.error('Error updating status:', error);
        res.status(500).json({ message: 'Error updating status', error });
      }
    });

    app.delete('/applied/:id', verifyToken, async (req, res) => {
      const { id } = req.params;

      try {
        const result = await appliedCollection.deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount > 0) {
          res.status(200).json({ message: 'Application deleted successfully!' });
        } else {
          res.status(404).json({ message: 'Application not found' });
        }
      } catch (error) {
        console.error('Error deleting application:', error);
        res.status(500).json({ message: 'Error deleting application', error });
      }
    });


    // notice sending code 

    app.post('/notices', async (req, res) => {
      const formData = req.body;
      try {
        const result = await allNotice.insertOne(formData);
        res.status(200).json({ message: 'Notice uploaded successfully!', data: result });
      } catch (error) {
        console.error('Error saving notice:', error);
        res.status(500).json({ message: 'Error saving notice', error });
      }
    });


    app.get('/notices', async (req, res) => {
      try {
        const notices = await allNotice.find().toArray();
        res.status(200).json(notices);
      } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ message: 'Error:', error });
      }
    });

    app.get('/notices/:id', async (req, res) => {
      const { id } = req.params;
      try {
        const message = await allNotice.findOne({ _id: new ObjectId(id) });
        if (message) {
          res.status(200).json(message);
        } else {
          res.status(404).json({ message: 'Nothing Found' });
        }
      } catch (error) {
        console.error('Error retrieving data:', error);
        res.status(500).json({ message: 'Error retrieving data', error });
      }
    });


    app.delete('/notices/:id', async (req, res) => {
      const { id } = req.params;

      try {
        const result = await allNotice.deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount > 0) {
          res.status(200).json({ message: 'Notice deleted successfully!' });
        } else {
          res.status(404).json({ message: 'Notice not found' });
        }
      } catch (error) {
        console.error('Error deleting Notice:', error);
        res.status(500).json({ message: 'Error deleting Notice', error });
      }
    });



    // email sending code

    app.post('/send-email', async (req, res) => {
      const { to, subject, text } = req.body;

      const mailOptions = {
        from: process.env.EMAIL_USER, // Sender address
        to, // List of recipients
        subject, // Subject of the email
        text, // Plain text body
      };

      try {
        const info = await transporter.sendMail(mailOptions);
        res.status(200).json({ message: 'Email sent successfully!', info });
      } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({ message: 'Error sending email', error });
      }
    });







  } catch (error) {
    // console.error("MongoDB connection error:", error);
  }


}

// Start the server
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Server is running!');
});

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
