import React, {useState} from 'react';
import styles from '../../styles/pages/LocalServices.module.css'

import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { getImage } from '../../backend/requests.js'

//custom map settings
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});


// Local Services Page. Shows map and local mechanic shops.
function LocalServices() {
  const [zipcode, setZipcode] = useState('');
  const [center, setCenter] = useState([51.505, -0.09]);
  const [mechanicShops, setMechanicShops] = useState([]);
  const [loading, setLoading] = useState(false);

  //when the user clicks Search, geocode the zipcode and find mechanic shops
  const handleSearch = async () => {
    if (!zipcode) {
      alert("Please enter a zipcode.");
      return;
    }
    setLoading(true);
    try {
      //geocode the zipcode using Nominatim API
      const geoResponse = await fetch(`https://nominatim.openstreetmap.org/search?postalcode=${zipcode}&country=us&format=json&limit=1`);
      const geoData = await geoResponse.json();
      if ( geoData.length === 0) {
        alert("No location found for that zipcode.");
        setLoading(false);
        return;
      }
      const lat = parseFloat(geoData[0].lat);
      const lon = parseFloat(geoData[0].lon);
      setCenter([lat, lon]);

      // query Overpass API for mechanic shops within a 5km radius
      const overpassQuery = `
        [out:json];
        (
          node["shop"="car_repair"](around:5000,${lat},${lon});
          way["shop"="car_repair"](around:5000,${lat},${lon});
          relation["shop"="car_repair"](around:5000,${lat},${lon});
        );
        out center;
      `;
      const overpassResponse = await fetch('https://maps.mail.ru/osm/tools/overpass/api/interpreter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: "data=" + encodeURIComponent(overpassQuery),
      });
      const overpassData = await overpassResponse.json();
      // Process returned elements into an array of shops
      let shops = await Promise.all(overpassData.elements.map(async (shop) => {
        let shopLat, shopLon;
        if (shop.type === 'node') {
          shopLat = shop.lat;
          shopLon = shop.lon;
        } else if (shop.center) {
          shopLat = shop.center.lat;
          shopLon = shop.center.lon;
        } else {
          shopLat = 0;
          shopLon = 0;
        }
        const shopName = shop.tags.official_name || shop.tags.name || "Unnamed Shop";

        const shopImage = await getImage(shopLat, shopLon);

        return {
          image: shopImage ? shopImage : false,
          id: shop.id,
          lat: shopLat, 
          lon: shopLon,
          name: shopName,
        };
      }));
      shops = shops.filter((shop)=>{return shop.name!== "Unnamed Shop"});
    
      setMechanicShops(shops);
    } catch (error) {
      console.error("Error fetching data:", error);
      alert("There was an error fetching data. Please try again later.");
    }
    setLoading(false);
  };
  return (
    <div className={`${styles.intro} ${styles.map}`}>
      <h3>Find Local Services</h3>
      <p>Discover local mechanic shops near you by entering your zipcode.</p>
      <div style={{ margin: '1rem' }}>
        <div>
          <input
            type="text"
            placeholder="Enter zipcode (e.g., 90210)"
            value={zipcode}
            onChange={(e)=>setZipcode(e.target.value)}
          />
          <button onClick={handleSearch} disabled={loading}>
            {loading ? 'Searching...' : 'Search'}
          </button>
        </div>

        <div style={{ marginTop: '1rem' }}>
          {/* This is the map*/}
          <MapContainer center={center} zoom={13} style={{ height: '400px', width: '100%' }}>
            <ChangeView center={center} zoom={13}/>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />

            <Marker position={center}>
              <Popup>Your location</Popup>
            </Marker>

            <Circle
              center={center}
              radius={5000}
              pathOptions={{ color: 'blue', fillColor: 'blue', fillOpacity: 0.1 }}
            />

            {mechanicShops.map((shop) => (
              <Marker key={shop.id} position={[shop.lat, shop.lon]} >
                <Popup>
                  <div style={{display:'flex',flexDirection:'column'}}>
                    <strong>{shop.name}</strong>
                    {shop.image && <img src={shop.image} alt="Image Unavailable"/>}
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>

        <div style={{ marginTop: '1rem' }}>
          {mechanicShops.length > 0 && (
            <>
              <h3>Mechanic Shops Found:</h3>
              <ul style={{ listStyleType: "none"}}>
                {mechanicShops.map((shop) => (
                  <li key={shop.id}>{shop.name}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Component to update the map view automatically when center changes
function ChangeView({ center, zoom }) {
  const map = useMap();
  map.setView(center, zoom);
  return null;
}
export default LocalServices;