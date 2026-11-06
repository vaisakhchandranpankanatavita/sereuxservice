import { Platform, View } from 'react-native';

type LatLng = { lat: number; lng: number };

/* Same OpenStreetMap + Leaflet view as the web app (src/map.jsx) and the pro app (pro-mobile/src/map.tsx),
   rendered through a WebView so it works without any paid maps SDK or API key. On web, a plain iframe does the same job. */
function html(home: LatLng, pro: LatLng | null, label: string) {
  const proJson = pro ? JSON.stringify(pro) : 'null';
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"/>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <style>html,body,#m{height:100%;margin:0}
  .pin{display:flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:50%;font-size:17px;color:#fff;box-shadow:0 2px 8px rgba(0,0,0,.35)}
  .pin-home{background:#141412}.pin-pro{background:#b8956a}</style></head>
  <body><div id="m" role="img" aria-label="${label.replace(/"/g, '')}"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var home=${JSON.stringify(home)}, pro=${proJson};
    var m=L.map('m',{zoomControl:true,attributionControl:true}).setView([home.lat,home.lng],14);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap'}).addTo(m);
    var homeIcon=L.divIcon({className:'',html:'<span class="pin pin-home">&#8962;</span>',iconSize:[34,34],iconAnchor:[17,17]});
    var proIcon=L.divIcon({className:'',html:'<span class="pin pin-pro">&#10148;</span>',iconSize:[34,34],iconAnchor:[17,17]});
    L.marker([home.lat,home.lng],{icon:homeIcon}).addTo(m);
    if(pro){
      var pm=L.marker([pro.lat,pro.lng],{icon:proIcon,zIndexOffset:500}).addTo(m);
      var line=L.polyline([[pro.lat,pro.lng],[home.lat,home.lng]],{color:'#141412',weight:4,opacity:.5,dashArray:'2 9'}).addTo(m);
      m.fitBounds(line.getBounds(),{padding:[40,40]});
    }
  </script></body></html>`;
}

export function LiveMap({ home, pro, label, height = 220 }: { home: LatLng; pro?: LatLng | null; label: string; height?: number }) {
  const source = html(home, pro ?? null, label);
  if (Platform.OS === 'web') {
    return <View style={{ height, borderRadius: 18, overflow: 'hidden' }}>
      {/* @ts-ignore: a plain DOM iframe on web */}
      <iframe srcDoc={source} style={{ width: '100%', height: '100%', border: 0 }} title={label} />
    </View>;
  }
  const { WebView } = require('react-native-webview');
  return <View style={{ height, borderRadius: 18, overflow: 'hidden' }}>
    <WebView source={{ html: source }} style={{ flex: 1 }} />
  </View>;
}
