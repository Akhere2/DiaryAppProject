const express = require('express');
const app = express();
const port = 3000;
const methodOverride = require('method-override');
const session = require('express-session');
const mongoose = require('mongoose');

// Connect to MongoDB
mongoose.connect('mongodb://127.0.0.1:27017/diaryApp')
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('Could not connect to MongoDB', err));

// Define a schema and model
const userSchema = new mongoose.Schema({
    name: String,
    email: String,
    password: String,
    log: [{ date: String, entry: String }]
});

const User = mongoose.model('User', userSchema);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));

app.set('view engine', 'ejs');
app.use(express.static('public'));

// Configure session middleware
app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set to true if using HTTPS
}));

// Middleware to check if user is authenticated
function isAuthenticated(req, res, next) {
    if (req.session.user) {
        return next();
    } else {
        res.redirect('/login');
    }

}

function isAuthorized(req, res, next) {
    if (req.session.user && req.session.user._id.toString() === req.params.id) {
        return next();
    } else {
        res.status(403).send('Forbidden');
    }
}

app.get("/", isAuthenticated, function(req, res) {
    res.render("home", { user: req.session.user });
    });

app.get("/login", function(req, res) {
    res.render("login", { user: req.session.user });
        });

app.post("/login", async function(req, res) {
            const { email, password } = req.body;
            const user = await User.findOne({ email, password });
            if (user) {
                req.session.user = user;
                res.redirect(`/profile/${user._id}`);
            } else {
                res.status(401).send('Invalid credentials');
            }
        });

app.get("/signup", function(req, res) {
    res.render("signup",{ user: req.session.user });
        });
        
app.post("/signup", async function(req, res) {
            const { name, email, password } = req.body;
            console.log(name, email, password);
        
            try {
                // Check if the email already exists
                const existingUser = await User.findOne({ email: email });
                if (existingUser) {
                    return res.status(400).send('Email already exists');
                }
        
                // Save data to MongoDB
                const user = new User({ name, email, password });
                await user.save();
                req.session.user = user; // Set user session
                res.redirect(`/profile/${user._id}`);
            } catch (err) {
                res.status(500).send('Error saving user to database');
            }
        });
        
        // Apply isAuthenticated middleware to the profile route
app.get("/profile/:id", isAuthenticated, isAuthorized, async function(req, res) {
            const userId = req.params.id;
            try {
                const user = await User.findById(userId);
                if (!user) {
                    return res.status(404).send('User not found');
                }
                res.render("profile", { name: user.name, userId: user._id , user: req.session.user });
            } catch (err) {
                res.status(500).send('Error fetching user from database');
            }
        });

app.get("/logout", function(req, res) {
            req.session.destroy(function(err) {
                if (err) {
                    return res.status(500).send('Error logging out');
                }
                res.redirect('/login');
            });
        });


    

app.get("/about", isAuthenticated, function(req, res) {
    res.render("about" ,{ user: req.session.user });
    });
    
app.get("/diary/:id",isAuthorized , isAuthenticated, async function(req, res) {

    const userId = req.params.id;
            try {
                const user = await User.findById(userId);
                if (!user) {
                    return res.status(404).send('User not found');
                }
            res.render("diary", { name: user.name, log: user.log , user: req.session.user });
            }
            catch (err) {
                res.status(500).send('Error fetching user from database');
            }
    });
app.get("/new/:id",isAuthorized , isAuthenticated, async function(req, res) {
    const userId = req.params.id;
    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).send('User not found');
        }
        res.render("new", { name: user.name, log: user.log , user: req.session.user });
    }
    catch (err) {
        res.status(500).send('Error fetching user from database');
    }
    });
app.post("/new/:id", isAuthenticated, isAuthorized, async function(req, res) {
        const userId = req.params.id;
        const { date, entry } = req.body;
    
        try {
            const user = await User.findById(userId);
            if (!user) {
                return res.status(404).send('User not found');
            }
    
            // Add the new entry to the user's log
            user.log.push({ date, entry });
            await user.save();
    
            // Redirect to the diary page
            res.redirect(`/diary/${userId}`);
        } catch (err) {
            res.status(500).send('Error saving entry to database');
        }
    });

app.get("/about/:id", isAuthenticated, isAuthorized, function(req, res) {
        res.render("aboutProfile" ,{ user: req.session.user });
        });

app.get("/edit/:id/:entryIndex", isAuthenticated, isAuthorized, async function(req, res) {
            const userId = req.params.id;
            const entryIndex = req.params.entryIndex;
            try {
                const user = await User.findById(userId);
                if (!user) {
                    return res.status(404).send('User not found');
                }
                const entry = user.log[entryIndex];
                res.render("edit", { entry, entryIndex, userId, user: req.session.user });
            } catch (err) {
                res.status(500).send('Error fetching entry from database');
            }
        });

// Route to handle edit entry submission
app.patch("/edit/:id/:entryIndex", isAuthenticated, isAuthorized, async function(req, res) {
    const userId = req.params.id;
    const entryIndex = req.params.entryIndex;
    const { date, entry } = req.body;
    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).send('User not found');
        }
        user.log[entryIndex] = { date, entry };
        await user.save();
        res.redirect(`/diary/${userId}`);
    } catch (err) {
        res.status(500).send('Error updating entry in database');
    }
});

app.delete("/delete/:id/:entryIndex", isAuthenticated, isAuthorized, async function(req, res) {
    const userId = req.params.id;
    const entryIndex = req.params.entryIndex;
    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).send('User not found');
        }
        user.log.splice(entryIndex, 1);
        await user.save();
        res.redirect(`/diary/${userId}`);
    } catch (err) {
        res.status(500).send('Error deleting entry from database');
    }
});
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});