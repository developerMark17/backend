require('dotenv').config();
var express = require('express');
var mongoClient = require('mongodb').MongoClient;
var cors = require("cors");
const app = express();
var session = require('express-session');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const http = require('http');
const socketIo = require('socket.io');
const PORT = process.env.PORT || 5000;

const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "http://localhost:3000", // React client address
        methods: ["GET", "POST"],
        credentials: true
    }
});

app.use(cors({ origin: "http://localhost:3000", credentials: true }));
app.use(express.urlencoded({
    extended: true
}))
app.use(express.json());
var constr =  process.env.MONGO_URI;
// const constr = functions.config().mongodb.connection_string;

app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set secure: true if you're using HTTPS
}));

// Root route to handle base URL access
app.get('/', (req, res) => {
    res.send('Welcome to the server!');
});

// Socket.IO connection handler
var noOfUsersConnected = 0;

io.on("connection", (socket) => {
    noOfUsersConnected++;
    console.log("No of useres connected are " + noOfUsersConnected);

    socket.on("message", (msg) => {
        console.log(msg);
        io.emit("message", msg);
        // socket.broadcast.emit("sendMsg", msg)
        // // socket.emit("sendMsg", msg)
    })
    socket.on('disconnect', function () {
        noOfUsersConnected--;
        console.log("No of users connected are " + noOfUsersConnected);
    })
})

// all products
app.get('/All_Products', (req, res) => {
    
    mongoClient.connect(constr).then((clientObj) => {
        var database = clientObj.db("e-commerce-react");
        database.collection("All_Products").find({}).toArray().then(documents => {
            res.send(documents);
            res.end();
        })
    })
});

app.get('/signin',(req, res)=>{
    mongoClient.connect(constr).then((clientObj)=>{

        var database = clientObj.db('e-commerce-react');
        database.collection('signin').find({}).toArray().then(documents=>{
            res.send(documents);
            res.end();
        })
    })
})
app.post('/signup', (req,res)=>{
    var user = {
        UserName: req.body.UserName,
        Email: req.body.Email,
        Password: req.body.Password,
        ConfirmPassword: req.body.ConfirmPassword
    }
    mongoClient.connect(constr).then(clientObj=>{
        var database = clientObj.db("e-commerce-react");
        database.collection('signup').insertOne(user).then(()=>{
            console.log('User Registered')
            res.end();
        })
    })
})

app.post('/payment', async (req, res) => {
    try {
        const { cartItems } = req.body;

        // Create a list of line items for the Stripe session
        const lineItems = cartItems.map(item => {
            // Parse the price string into a number and handle NaN gracefully
            const price = parseFloat(item.price.replace("₹", "").replace(",", ""));

            if (isNaN(price)) {
                throw new Error(`Invalid price for item: ${item.title}`);
            }
            
            return {
                price_data: {
                    currency: 'inr',
                    product_data: {
                        name: item.title,
                        images: [item.image],
                    },
                    unit_amount: price * 100, // Stripe expects the amount in cents
                },
                quantity: item.quantity,
            };
        });

        // Create a Stripe checkout session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: 'payment',
            success_url: 'http://localhost:3000/success', // Redirect URL after successful payment
            cancel_url: 'http://localhost:3000/cancel', // Redirect URL if payment is canceled
        });

        res.json({ id: session.id });
    } catch (error) {
        console.error("Payment error:", error);
        res.status(500).json({ error: 'An error occurred during payment.' });
    }
});

app.get('/check-login', (req, res) => {
    if (req.session.user) {
        res.json({ loggedIn: true });
    } else {
        res.json({ loggedIn: false });
    }
});

// Sign in and set session
app.post('/signin', (req, res) => {
    const { UserName, Password } = req.body;
    mongoClient.connect(constr).then((clientObj) => {
        var database = clientObj.db('e-commerce-react');
        database.collection('signin').findOne({ UserName, Password }).then(user => {
            if (user) {
                req.session.user = user;
                res.json({ loggedIn: true });
            } else {
                res.status(401).json({ loggedIn: false });
            }
        }).catch(error => {
            console.error('Error during sign in:', error);
            res.status(500).json({ error: 'Internal server error' });
        });
    });
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});