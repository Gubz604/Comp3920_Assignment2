const database = require('../databaseConnection');

async function createUser(postData) {
	let createUserSQL = `
		INSERT INTO user
		(username, password)
		VALUES
		(:user, :passwordHash);
	`;

	let params = {
		user: postData.user,
		passwordHash: postData.hashedPassword
	}

	try {
		const results = await database.query(createUserSQL, params);

		console.log("Successfully created user");
		console.log(results[0]);
		return true;
	}
	catch (err) {
		console.log("Error inserting user");
		console.log(err);
		return false;
	}
}

async function getUsers(postData) {
	let getUsersSQL = `
		SELECT username, password
		FROM user;
	`;

	try {
		const results = await database.query(getUsersSQL);

		console.log("Successfully retrieved users");
		// console.log(results[0]);
		return results[0];
	}
	catch (err) {
		console.log("Error getting users");
		console.log(err);
		return false;
	}
}

async function getUser(postData) {
	let getUserSQL = `
	SELECT username, password
	FROM user
	WHERE username = :user;
	`;

	let params = {
		user: postData.user
	}

	try {
		const results = await database.query(getUserSQL, params);

		console.log("Successfully queried the database");
		// console.log(results[0]);
		return results[0];
	}
	catch (err) {
		console.log("Error trying to find user");
		console.log(err);
		return false;
	}
}

async function getUserIdsByUsername(usernames) {
	if (!usernames || usernames.length === 0) {
		return [];
	}

	let getUserIdsSQL = `
        SELECT user_id FROM user WHERE username IN (${usernames.map(() => "?").join(", ")})
    `;

	try {
		const [results] = await database.execute(getUserIdsSQL, usernames);
		return results.map(row => row.user_id).filter(id => id !== undefined);
	}
	catch (err) {
		console.error("Error fetching user IDs:", err);
		throw err;
	}
}

async function getUsersNotInRoom(roomId) {
	const sql = `
	  SELECT u.user_id, u.username
	  FROM user u
	  WHERE u.user_id NOT IN (
		SELECT user_id FROM room_user WHERE room_id = ?
	  )
	`;
	const [rows] = await database.execute(sql, [roomId]);
	return rows;
}


module.exports = { createUser, getUsers, getUser, getUserIdsByUsername, getUsersNotInRoom };