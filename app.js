const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const app = express();
app.use(express.json());

const PATH = path.join(__dirname, "twitterClone.db");
let db = null;

const initializeServerAndDatabase = async (request, response) => {
  try {
    db = await open({
      filename: PATH,
      driver: sqlite3.Database,
    });

    app.listen(3000, () => {
      console.log("Server is Started....");
    });
  } catch (e) {
    console.log(e);
    process.exit(-1);
  }
};

initializeServerAndDatabase();

//middleware function

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authToken = request.headers["authorization"];
  if (authToken !== undefined) {
    jwtToken = authToken.split(" ")[1];
  }
  if (jwtToken === undefined) {
    response.status(401);
    response.send("Invalid JWT Token");
  } else {
    const isValidToken = jwt.verify(
      jwtToken,
      "hgkjbjvngcmhvk",
      (error, payload) => {
        if (error) {
          response.status(401);
          response.send("Invalid JWT Token");
        } else {
          request.username = payload.username;
          next();
        }
      }
    );
  }
};

//Register API
app.post("/register/", async (request, response) => {
  const { username, password, name, gender } = request.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  const selectUserQuery = `
        SELECT * FROM user WHERE username = '${username}';
    `;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser !== undefined) {
    response.status(400);
    response.send("User already exists");
  } else {
    if (password.length < 6) {
      response.status(400);
      response.send("Password is too short");
    } else {
      const QUERY = `
                INSERT INTO user(username,password,name,gender)
                values('${username}','${hashedPassword}','${name}','${gender}');
              `;
      await db.run(QUERY);
      response.status(200);
      response.send("User created successfully");
    }
  }
});

//login API
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const selectUserQuery = `
        SELECT * FROM user WHERE username = '${username}';
    `;
  const dbUser = await db.get(selectUserQuery);
  if (dbUser === undefined) {
    response.status(400);
    response.send("Invalid user");
  } else {
    const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
    if (!isPasswordMatched) {
      response.status(400);
      response.send("Invalid password");
    } else {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "hgkjbjvngcmhvk");
      response.status(200);
      response.send({ jwtToken });
    }
  }
});

app.get("/get/", async (request, response) => {
  const selectFollowersQuery = `   
        SELECT         
            *                  
        FROM 
            tweet
       

                  
           `;                     
                
    
  const dbUser = await db.all(selectFollowersQuery);
  response.send(dbUser)
});

//API-3
app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  const Query = `
        SELECT
            DISTINCT username,tweet,date_time As dateTime   
        FROM 
            user INNER JOIN follower ON user.user_id = follower.follower_user_id
            INNER JOIN tweet ON follower.follower_user_id = tweet.user_id
        ORDER BY date_time DESC
        LIMIT 4         
    `;
  const tweets = await db.all(Query);
  response.send(tweets);
});

//API-4
app.get("/user/following/", authenticateToken, async (request, response) => {
  const username = request.username;
  const Query = `
        SELECT
            name 
        FROM 
            user
        WHERE 
            user_id IN (
                 SELECT
                    following_user_id                      
                 FROM 
                     user INNER JOIN follower ON 
                     user.user_id = follower.follower_user_id
                 WHERE
                     username = '${username}'                    
            )  ;      
    `;
  const userFollows = await db.all(Query);
  response.send(userFollows);
});

//API-5
app.get("/user/followers/", authenticateToken, async (request, response) => {
  const username = request.username;
  const Query = `
        SELECT
            name 
        FROM 
            user
        WHERE 
            user_id IN (
                 SELECT
                    follower_user_id                      
                 FROM 
                     user INNER JOIN follower ON 
                     user.user_id = follower.following_user_id
                 WHERE
                     username = '${username}'                    
            )  ;      
    `;
  const userFollowers = await db.all(Query);
  response.send(userFollowers);
});

//API-6
app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
  const { tweetId } = request.params;
  const username = request.username;  
  const selectFollowersQuery = `   
        SELECT
            user_id
        FROM 
            tweet 
        WHERE 
            tweet.user_id IN (
                 SELECT
                    following_user_id                      
                 FROM 
                     user INNER JOIN follower ON 
                     user.user_id = follower.follower_user_id
                 WHERE
                     user.username = '${username}'                                          
            )
            AND tweet.tweet_id = ${tweetId}         
        `;
  const isFollower = await db.get(selectFollowersQuery);
  if (!isFollower) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    const getTweet = `
           SELECT 
                tweet,
                COUNT(DISTINCT like_id) AS likes,
                COUNT(DISTINCT reply_id) AS replies,
                tweet.date_time AS dateTime                   
            FROM 
                (tweet INNER JOIN like ON tweet.tweet_id = like.tweet_id) AS T 
                INNER JOIN reply ON T.tweet_id = reply.tweet_id                
            WHERE
                tweet.tweet_id = ${tweetId};
        `;
    const tweet = await db.get(getTweet);
    response.send(tweet);
  }
});


//API-7
app.get("/tweets/:tweetId/likes", authenticateToken, async (request, response) => {
  const { tweetId } = request.params;
  const username = request.username;
  const getUserId = `
        SELECT
            user_id
        FROM 
           user
        WHERE
           username = '${username}';    
    `;
    let responseUserId = await db.get(getUserId);
    const {user_id} = responseUserId;
  const selectFollowersQuery = `   
        SELECT
            user_id
        FROM 
            tweet 
        WHERE 
            tweet.user_id IN (
                 SELECT
                    following_user_id                      
                 FROM 
                     user INNER JOIN follower ON 
                     user.user_id = follower.follower_user_id
                 WHERE
                     user.username = '${username}'                                          
            )
            AND tweet.tweet_id = ${tweetId}         
        `;
  const isFollower = await db.get(selectFollowersQuery);
  if (!isFollower) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    const getLikedUsersQuery = `
           SELECT 
              user.name                   
            FROM 
                user INNER JOIN like ON user.user_id = like.user_id  
            WHERE
                  like.user_id IN (
                     SELECT
                         following_user_id
                      FROM  
                          follower
                      WHERE
                         follower.follower_user_id = ${user_id}                   
                 )                
                AND like.tweet_id = ${tweetId}
        `;
    const getLikedUsers = await db.all(getLikedUsersQuery);
    let object = {"likes":[]}
    for (obj of getLikedUsers){
         (object["likes"]).push(obj.name)   
    }
    response.send(object);
  }
});


//API-8
app.get("/tweets/:tweetId/replies/", authenticateToken, async (request, response) => {
  const { tweetId } = request.params;
  const username = request.username;
  const selectFollowersQuery = `   
        SELECT
            user_id
        FROM 
            tweet 
        WHERE 
            tweet.user_id IN (
                 SELECT
                    following_user_id                      
                 FROM 
                     user INNER JOIN follower ON 
                     user.user_id = follower.follower_user_id
                 WHERE
                     user.username = '${username}'                                          
            )
            AND tweet.tweet_id = ${tweetId}         
        `;
  const isFollower = await db.get(selectFollowersQuery);
  if (!isFollower) {
    response.status(401);
    response.send("Invalid Request");
  } else {
    const getRepliesUsersQuery = `
           SELECT 
                 user.name                   
            FROM 
                (tweet INNER JOIN reply ON tweet.tweet_id = reply.tweet_id) AS T 
                INNER JOIN user ON T.user_id = user.user_id                
            WHERE
                  user.user_id IN (
                     SELECT
                         reply.user_id 
                      FROM  
                          tweet INNER JOIN reply ON tweet.tweet_id = reply.tweet_id
                      WHERE
                         tweet.tweet_id = ${tweetId}                   
                 )                
                
            GROUP By reply.user_id;
        `;
    const getRepliedUsers = await db.all(getRepliesUsersQuery);
    let object = {"replies":[]}
    for (obj of getRepliedUsers){
         (object["replies"]).push(obj.name)   
    }
    response.send(object);
  }
});


//API-9
app.get("/user/tweets/",authenticateToken,async (request,response) =>{
    const username = request.username;
    const getUserId = `
        SELECT
            user_id
        FROM 
           user
        WHERE
           username = '${username}';    
    `;
    let responseUserId = await db.get(getUserId);
    const {user_id} = responseUserId;
     const getUserTweetsQuery = `
        SELECT         
            tweet,
            COUNT(DISTINCT like_id) AS likes,
            COUNT(DISTINCT reply_id) AS replies,
            tweet.date_time AS dateTime                   
        FROM 
            (tweet INNER JOIN like ON tweet.tweet_id = like.tweet_id) AS T 
            INNER JOIN reply ON T.tweet_id = reply.tweet_id
       WHERE
           tweet.user_id = ${user_id}                          
       GROUP BY tweet
    `;
     const tweets = await db.all(getUserTweetsQuery);
    response.send(tweets);         
});

//API-10
app.post("/user/tweets/",authenticateToken, async (request,response) =>{
    const {tweet} = request.body;
    const {username} = request;
    const getUserId = `
        SELECT
            user_id
        FROM 
           user
        WHERE
           username = '${username}';    
    `;
    let responseUserId = await db.get(getUserId);
    const {user_id} = responseUserId;
    const date = new Date();    
    const currentDate = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()} ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;
    const postTweetQuery = `
       INSERT INTO tweet (tweet, user_id, date_time)
       VALUES ('${tweet}', ${user_id}, '${currentDate}');
                         
    `;
    await db.run(postTweetQuery);
    response.send("Created a Tweet");
}); 


//API-11
app.delete("/tweets/:tweetId/",authenticateToken, async (request,response) =>{
    const {username} = request;
    const { tweetId } = request.params;
    const getUserId = `
        SELECT
            user_id
        FROM 
           user
        WHERE
           username = '${username}';    
    `;
    let responseUserId = await db.get(getUserId);
    const {user_id} = responseUserId;
    const checkUser = `
        SELECT
           tweet
        FROM
           tweet
        WHERE 
            tweet.tweet_id = ${tweetId}
            AND tweet.user_id = ${user_id}            
    `;
    const isValidRequest = await db.get(checkUser);
    if(!isValidRequest){
        response.status(401);
        response.send("Invalid Request")
    }else{
        const deleteTweetQuery = `
        DELETE FROM
            tweet
        WHERE
            tweet_id = ${tweetId};
    `;
    await db.run(deleteTweetQuery);
    response.send("Tweet Removed");    
    }         
    
});



module.exports = app;
