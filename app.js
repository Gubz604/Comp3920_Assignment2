
require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const bcrypt = require('bcrypt');
saltRounds = 12;

const database = require('./databaseConnection');
const db_utils = require('./database/db_utils');
const db_user = require('./database/users');
const db_room = require('./database/room');
const db_room_user = require('./database/room_user');
const db_message = require('./database/message');
const db_emoji_reaction = require('./database/emoji_reaction');
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
    resave: true,
    cookie: { maxAge: expireTime, secure: false, httpOnly: true }
}
))

app.use(express.static('public'));

/* ------------------------- ROUTES -------------------------------- */
app.get('/', async (req, res) => {
    if (req.session && req.session.authenticated) {
        try {
            const userGroups = await db_room_user.getUserGroupsWithMessages(req.session.username);
            res.render('loggedIn', {
                name: req.session.username || 'Guest',
                groups: userGroups
            });
        } catch (err) {
            console.error("Error fetching user groups: ", err);
            res.render('errorMessage', { error: "Failed to load groups" });
        }
    } else {
        res.render('home');
    }
});

app.post('/signup', (req, res) => {
    res.render('signupUser')
})

app.post('/submitUser', async (req, res) => {
    var username = req.body.username;
    var password = req.body.password;

    if (!username || !password) {
        let missingParam = "";
        if (!username && !password) {
            missingParam = "Username and Password";
        } else if (!username) {
            missingParam = "Username";
        } else {
            missingParam = "Password";
        }
        return res.get('signup', { missingParam });
    }

    var hashedPassword = bcrypt.hashSync(password, saltRounds);

    var success = await db_user.createUser({ user: username, hashedPassword: hashedPassword });

    if (success) {
        var results = await db_user.getUsers();
        console.log(`User: ${username} created!`);
        res.render('submitUser', { users: results });
    } else {
        res.render("errorMessage", { error: "Failed to create user." });
    }
});

app.post('/login', (req, res) => {
    res.render('loginUser')
})

app.post('/loggingIn', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        let missingParam = "";
        if (!username && !password) {
            missingParam = "Username and Password";
        } else if (!username) {
            missingParam = "Username";
        } else {
            missingParam = "Password";
        }
        return res.render('loggingIn', { missingParam });
    }

    const users = await db_user.getUser({ user: username });

    if (users && users.length === 1) {
        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password);

        if (isMatch) {
            req.session.authenticated = true;
            req.session.username = username;
            req.session.cookie.maxAge = expireTime;

            // 🔍 Fetch the user's groups before rendering the page
            try {
                const userGroups = await db_room_user.getUserGroupsWithMessages(username);
                return res.render('loggedIn', {
                    name: req.session.username,
                    groups: userGroups || []
                });
            } catch (err) {
                console.error("Error fetching user groups:", err);
                return res.render('errorMessage', { error: "Failed to load groups" });
            }
        } else {
            console.log("Invalid password");
            return res.render('login');
        }
    } else {
        console.log('Invalid number of users matched: ' + (users ? users.length : 0) + " (expected 1).");
        return res.render('loginUser');
    }
});


app.get('/addNewGroup', async (req, res) => {
    const usersList = await db_user.getUsers();
    res.render('createNewGroup', { users: usersList });
})

app.post('/submitGroup', async (req, res) => {
    const groupName = req.body.groupName;
    let memberUsernames = req.body.members || []; // Ensure it's always an array
    const currentUsername = req.session.username;

    // console.log("Group Name:", groupName);
    // console.log("Raw Selected Members:", memberUsernames);

    // Ensure `memberUsernames` is always an array
    if (!Array.isArray(memberUsernames)) {
        memberUsernames = [memberUsernames];
    }

    memberUsernames = memberUsernames.filter(username => username.trim() !== "");

    if (!memberUsernames.includes(currentUsername)) {
        memberUsernames.push(currentUsername);
    }

    // console.log("Final Members (Usernames):", memberUsernames);

    const groupCreationTime = getCurrentDatetime();

    try {
        // 🔍 Step 1: Convert usernames to user IDs
        const userIds = await db_user.getUserIdsByUsername(memberUsernames);
        console.log("Mapped User IDs:", userIds);

        if (userIds.length === 0) {
            return res.render('errorMessage', { error: "Failed to find user IDs." });
        }

        // 🔥 Step 2: Create the Room
        const roomId = await db_room.createGroup({
            group_name: groupName,
            group_start_datetime: groupCreationTime
        });

        console.log(`Group created with ID: ${roomId}`);

        // 🔥 Step 3: Assign Users to Room (Insert into room_user)
        const addedUsers = await db_room_user.addUsersToRoom(roomId, userIds);
        console.log(`Added ${addedUsers.length} users to room ${roomId}`);

        res.redirect('/');
    }
    catch (err) {
        console.error("Error creating group or assigning users:", err);
        res.render('errorMessage', { error: "Failed to create group and assign users." });
    }
});

app.get('/group/:roomId', sessionValidation, async (req, res) => {
    const roomId = req.params.roomId;
    const username = req.session.username;

    try {
        const messages = await db_message.getMessagesByRoom(roomId);

        const groupInfo = await db_room.getRoomById(roomId);

        if (!groupInfo) {
            return res.render('errorMessage', { error: "Group not found" });
        }

        res.render('chatroom', {
            roomId,
            groupName: groupInfo.name,
            messages,
            username
        });
    } catch (err) {
        console.error("Error fetching chatroom messages: ", err);
        res.render('errorMessage', { error: "Failed to load chatroom" });
    }
});

app.get('/chatroom/:roomId', sessionValidation, async (req, res) => {
    const roomId = req.params.roomId;
    const username = req.session.username;

    try {
        // 1) Fetch all messages for this room
        const messages = await db_message.getMessagesByRoom(roomId);

        // 2) Fetch reaction counts for each message
        const reactionRows = await db_emoji_reaction.getReactionsByRoom(roomId);

        // We'll build a map: { message_id -> [ {emoji_id, image, name, total_count}, ... ] }
        const reactionMap = {};
        for (let row of reactionRows) {
            if (!reactionMap[row.message_id]) {
                reactionMap[row.message_id] = [];
            }
            reactionMap[row.message_id].push({
                emoji_id: row.emoji_id,
                image: row.image,
                name: row.name,
                total_count: row.total_count
            });
        }

        // 3) Render the chatroom with messages + reactionMap
        res.render('chatroom', {
            roomId,
            messages,
            username,
            reactionMap
        });
    } catch (err) {
        console.error("Error fetching chatroom messages: ", err);
        res.render('errorMessage', { error: "Failed to load chatroom" });
    }
});

app.post('/chatroom/:roomId/markAsRead', sessionValidation, async (req, res) => {
    const roomId = req.params.roomId;
    const username = req.session.username;

    try {
        await db_room_user.updateLastReadMessage(username, roomId);
        res.sendStatus(200); // success
    } catch (err) {
        console.error("Error marking as read:", err);
        res.sendStatus(500);
    }
});

app.get('/inviteUsers/:roomId', sessionValidation, async (req, res) => {
    const roomId = req.params.roomId;
    try {
        const currentMembers = await db_room_user.getRoomMembers(roomId);

        const nonMembers = await db_user.getUsersNotInRoom(roomId);

        res.render('inviteUsers', {
            roomId,
            currentMembers,
            nonMembers
        });
    } catch (err) {
        console.error("Error loading invite page:", err);
        res.render('errorMessage', { error: "Failed to load invite page." });
    }
});

app.post('/inviteUsers/:roomId/submit', sessionValidation, async (req, res) => {
    const roomId = req.params.roomId;
    let invitees = req.body.invitees; // could be a single value or an array

    // If nothing is checked, just redirect back
    if (!invitees) {
        return res.redirect(`/chatroom/${roomId}`);
    }

    // Make sure we have an array of user IDs
    if (!Array.isArray(invitees)) {
        invitees = [invitees];
    }

    try {
        // Insert these user IDs into room_user
        await db_room_user.addUsersToRoom(roomId, invitees);
        // Then redirect back to the chatroom or wherever
        res.redirect(`/chatroom/${roomId}`);
    } catch (err) {
        console.error("Error adding users to room:", err);
        res.render('errorMessage', { error: "Failed to add users to room." });
    }
});

app.post('/sendMessage', sessionValidation, async (req, res) => {

    const { roomId, messageContent } = req.body;
    const username = req.session.username;

    if (!roomId || !messageContent || !username) {
        console.error("Missing required fields.");
        return res.render('errorMessage', { error: "Missing data for message" });
    }

    try {
        await db_message.sendMessage(roomId, username, messageContent);
        console.log("Message sent successfully!");

        res.redirect(`/chatroom/${roomId}`);
    } catch (err) {
        console.error("Error sending message:", err);
        res.render('errorMessage', { error: "Failed to send message" });
    }
});

app.post('/messages/:messageId/react', async (req, res) => {
    const messageId = req.params.messageId; // from URL
    const emojiId = req.body.emojiId;         // from form (button value)
    const roomId = req.body.roomId;           // from hidden input
    const username = req.session.username;    // from session

    try {
        const userIds = await db_user.getUserIdsByUsername([username]);
        if (!userIds || userIds.length === 0) {
            throw new Error("User ID not found for username: " + username);
        }
        const userId = userIds[0];

        await db_emoji_reaction.addReaction(messageId, userId, emojiId);
        res.redirect(`/chatroom/${roomId}`);
    } catch (err) {
        console.error("Error adding reaction:", err);
        res.render('errorMessage', { error: "Failed to add reaction." });
    }
});



app.get('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) {
            console.error("Error destroying session:", err);
            return res.render("errorMessage", { error: "Failed to log out" });
        }

        res.clearCookie('connect.sid', { path: '/' });
        console.log("User logged out successfully.");

        res.redirect('/');
    });
});




/* ------------------------- END OF ROUTES ------------------------- */

function isValidSession(req) {
    if (req.session.authenticated) {
        return true;
    }
    return false;
}

function sessionValidation(req, res, next) {
    if (!req.session || !req.session.authenticated) {
        console.log("Session invalid... Redirecting to home page");
        return res.redirect('/');
    }
    next();
}



function getCurrentDatetime() {
    const now = new Date();
    return now.toISOString().slice(0, 19).replace('T', ' '); // Formats as "YYYY-MM-DD HH:MM:SS"
}

app.get("*", (req, res) => {
    res.status(404);
    res.render("404");
})

app.listen(port, () => {
    console.log("Node application listening on port " + port);
});