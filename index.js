require('dotenv').config();
const express = require('express');
const cors = require('cors');
const app = express();
const dns = require('dns');
const mongoose = require('mongoose')

// Basic Configuration
const port = process.env.PORT || 3000;

app.use(cors());

app.use('/public', express.static(`${process.cwd()}/public`));

app.get('/', function(req, res) {
  res.sendFile(process.cwd() + '/views/index.html');
});

app.use(express.urlencoded({ extended: true }));

// Options for dns.lookup() function
const options = {
  family: 0,
  hints: dns.ADDRCONFIG | dns.V4MAPPED,
};

// Connection to DB
mongoose.connect(process.env['MONGO_URI'], { useNewUrlParser: true, useUnifiedTopology: true });

// Creating schema to store originalUrl and shorUrl
const urlSchema = new mongoose.Schema({
  originalUrl: String,
  shortUrl: Number
});

const Url = mongoose.model('Url', urlSchema);


// API endpoint for /api/shorturl
app.post('/api/shorturl', function(req, res) {
  console.log('-------------------------------------')
  const userUrl = req.body.url;

  // Checking with regex if it is a valid url
  const validUrlRegex = /^(http(s):\/\/.)[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)$/;
  const urlProtocolRegex = /^(http(s):\/\/)/;
  const urlTailRegex = /(\/.*)/;
  
  // If not valid send error
  if (!userUrl.match(validUrlRegex)) {
    res.json({ error: 'invalid url' })
  } 
  // If valid, clean the url
  else {
    const urlWithoutProtocol = userUrl.replace(urlProtocolRegex, "");
    const urlWithoutTail = urlWithoutProtocol.replace(urlTailRegex,"")

    // Checking if the url is valid with dns cor module
    dns.lookup(urlWithoutTail, options, async (err, address, family) => {
      // if dns core module returns an error
      if (err) {
        console.log(err);
        res.json({ error: 'invalid url' });
      } 
      // Else continue the process
      else {
        // Find url in DB
        result = await Url.findOne({ originalUrl: userUrl }).exec();

        // If the document exist, send response
        if (result) {
          console.log("document found");
          res.json({originalUrl: result.originalUrl, shortUrl: result.shortUrl});
        } 
        // Else we need to add the document
        else {
          console.log("this document is not found")
          
          // get the last document of the collection to get the max shortUrl number
          let count = 0
          let listOfDocument = await Url.find().sort({shortUrl: -1}).limit(1);
          if (listOfDocument.length == 0) {
            count += 1
          } else {
            count = listOfDocument[0].shortUrl + 1;
          }          

          // Creating a new document with the new shortUrl
          let urlToAdd = {
            originalUrl: userUrl,
            shortUrl: count
          }
          let newEntry = await new Url(urlToAdd).save();
          console.log("document created")
          // Send response
          res.json(urlToAdd);
        }        
      }
    }); 
  }
});

// API endpoint for /api/shorturl/:shorturl?
app.get('/api/shorturl/:shorturl', async function(req, res) {
  console.log('-------------------------------------')
  let result = await Url.findOne({shortUrl: req.params.shorturl})
  res.redirect(result.originalUrl);
});

app.listen(port, function() {
  console.log(`Listening on port ${port}`);
});
