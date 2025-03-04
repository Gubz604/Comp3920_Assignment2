
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bcrypt = require('bcrypt');
saltRounds = 12;

const database = require('./databaseConnection');
const db_utils = require('./database/db_utils');
const db_user = require('./database/users');
const success = db_utils.printMySQLVersion();

const port = process.env.PORT || 3000;

const app = express();

const expireTime = 60 * 60 * 1000 // expires after 1 hour

/* ---------------------- SECRET INFORMATION ----------------------- */
const mongodb_user = process.env.MONGODB_USER;
const mongodb_password = process.env.MONGODB_PASSWORD;
const mongodb_session_secret = process.env.MONGODB_SESSION_SECRET;

const node_session_secret = process.env.NODE_SESSION_SECRET;
/* ------------------- END OF SECRET INFORMATION ------------------- */

app.set('view engine', 'ejs');

app.use(express.urlencoded({ extended: false }));

var mongoStore = MongoStore.create({
    mongoUrl: `mongodb+srv://${mongodb_user}:${mongodb_password}@mycluster.godx1.mongodb.net/?retryWrites=true&w=majority&appName=MyCluster`,
    crypto: {
        secret: mongodb_session_secret
    }
});

app.use(session({
    secret: node_session_secret,
    store: mongoStore,
    saveUninitialized: false,
    resave: true
}
))

app.use(express.static('public'));

/* ------------------------- ROUTES -------------------------------- */
app.get('/', (req, res) => {
    if (isValidSession(req)) {
        res.render('loggedIn', { name: req.session.username })
    } else {
        res.render('home')
    }
})



/* ------------------------- END OF ROUTES ------------------------- */

function isValidSession(req) {
    if (req.session.authenticated) {
        return true;
    }
    return false;
}

function sessionValidation(req, res, next) {
    if (!isValidSession(req)) {
        console.log("not valid session... Session destroyed!")
        req.session.destroy();
        res.redirect('/');
        return;
    }
    else {
        next();
    }
}

app.get("*", (req, res) => {
    res.status(404);
    res.render("404");
})

app.listen(port, () => {
    console.log("Node application listening on port " + port);
});