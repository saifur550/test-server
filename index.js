const express = require('express')
const cors = require('cors');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000;
require('dotenv').config()

app.use(cors());
app.use(express.json());


function verifyJWT (req, res, next){
  const authHeader = req.headers.authorization;

  if(!authHeader){
    return res.status(401).send({message:`UnAuthorized access`})
  }
  const token = authHeader.split(' ')[1]; //
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    
    if (err) {
      console.log(err);
      return res.status(403).send({ message: 'Forbidden access' })
    }
    req.decoded = decoded;
    next();
  });
}

//require('crypto').randomBytes(64).toString('hex')
//01a80547cd5e2cc9640edd746a5de1bd3a3362389399789336e2e79ea9439349f5833665c10860f3dc31cc68f3d6b88ad61bce8352bcb9fca8f678f028e0d804

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.kc11k.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


async function run(){

    try{
        await client.connect();
        console.log('database connect');
        const serviceCollection =client.db('doctors_portal').collection('services')
        const bookingCollection =client.db('doctors_portal').collection('bookings')
        const userCollection =client.db('doctors_portal').collection('users')
        const doctorCollection =client.db('doctors_portal').collection('doctors')


        const verifyAdmin = async (req, res, next) => {
          const requester = req.decoded.email;
          const requesterAccount = await userCollection.findOne({ email: requester });
          if (requesterAccount.role === 'admin') {
            next();
          }
          else {
            res.status(403).send({ message: 'forbidden' });
          }
        }




        app.get('/services', async (req, res)=>{
            const query = {};
            const cursor = serviceCollection.find(query).project({name:1})
            const services = await cursor.toArray()
            res.send(services)

        })

        // test deploy 


        //get all user 
        app.get('/user' , verifyJWT,  async ( req, res)=>{
          const users = await userCollection.find().toArray()
          res.send(users)
        })

        app.put('/user/admin/:email' , verifyJWT,  verifyAdmin,  async(req, res)=>{
          const email = req.params.email;
          const filter =  {email: email};
          const updateDoc = {
           $set:{role:'admin'},
          };
          const result = await userCollection.updateOne(filter, updateDoc);
          res.send(result);

        })


      app.get('/admin/:email', async( req, res)=>{
        const email =req.params.email;
        const user = await userCollection.findOne({email:email})
        const isAdmin = user.role === 'admin';
        res.send({admin:isAdmin})
      })


        app.put('/user/:email' ,  async(req, res)=>{
          const email = req.params.email;
          const user = req.body
          const filter =  {email: email};
          const options = {upsert: true}

          // create a document that sets the plot of the movie
        const updateDoc = {
         $set: user
        };
        const result = await userCollection.updateOne(filter, updateDoc, options);
        const token = jwt.sign({email:email}, process.env.ACCESS_TOKEN_SECRET,{expiresIn: '24h' } )
        res.send({result, token});
        })




      // Warning: This is not the proper way to query multiple collection. 
       // After learning more about mongodb. use aggregate, lookup, pipeline, match, group
      app.get('/available', async(req, res) =>{
      const date = req.query.date;

      // step 1:  get all services
      const services = await serviceCollection.find().toArray();



      // step 2: get the booking of that day. output: [{}, {}, {}, {}, {}, {}]
      const query = {date: date};
      const bookings = await bookingCollection.find(query).toArray();



      // step 3: for each service
      services.forEach(service=>{
        // step 4: find bookings for that service. output: [{}, {}, {}, {}]
        const serviceBookings = bookings.filter(book => book.treatment === service.name);
        // step 5: select slots for the service Bookings: ['', '', '', '']
        const booked = serviceBookings.map(book => book.slot);
        // step 6: select those slots that are not in bookedSlots
        const available = service.slots.filter(slot => !booked.includes(slot));
        //step 7: set available to slots to make it easier 
        service.slots = available;
      });
      res.send(services);
      
      })




   


      app.get('/booking', verifyJWT,  async (req, res)=>{
        const patient = req.query.patient;
        const decodeEmail= req.decoded.email
        if(patient===decodeEmail){

          const query = {patient: patient};
          const bookings = await bookingCollection.find(query).toArray();
           return res.send(bookings);

        }
        else{
          return res.status(403).send({ message: 'Forbidden access' })
        }

      
      })


      app.get('/booking/:id', verifyJWT,  async( req, res)=>{
        const id = req. params.id;
        const query = {_id : ObjectId(id)}
        const booking = await bookingCollection.findOne(query)
        res.send(booking)
      })


      app.post('/booking', verifyJWT, async( req, res)=>{
        const booking = req.body;
        const query = {treatment:booking.treatment, date:booking.date, patient:booking.patient}
        const exists = await bookingCollection.findOne(query)

        if(exists){
          return res.send({success: false, booking: exists})
        }
        const result = await bookingCollection.insertOne(booking);
         return res.send({success:true, result});


      })

      app.post('/doctor', async ( req, res) =>{
        const doctor = req.body
        // console.log(doctor);
        const result = await doctorCollection.insertOne(doctor)
        res.send(result)
      })


      app.get('/doctor', async ( req, res) =>{
        const doctors = await  doctorCollection.find().toArray()
        res.send(doctors)
      })

      

      //delete
      app.delete('/doctor/:email', async ( req, res) =>{
       const email = req.params.email;
       const filter = {email:email}
      //  console.log(filter);
        const result = await doctorCollection.deleteOne(filter)
        res.send(result)
      })
        
        
    }   

    finally{

    }

}

run().catch(console.dir())

app.get('/', (req, res) => {
  res.send('Hello World doctor portal!')
})

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`)
})