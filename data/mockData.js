// data/mockData.js
// Données de test — seront remplacées par Supabase plus tard
// C'est le seul endroit à modifier pour changer les photos de test

export const PHOTOS = [
  { id:1,  url:"https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=800&q=80", location:"Alpes",       city:"Chamonix",     year:"2023", size:3.5, lat:45.92, lng:6.87,  faces:[] },
  { id:2,  url:"https://images.unsplash.com/photo-1532983330958-4b32a24a4271?w=800&q=80", location:"Nice",        city:"Nice",         year:"2023", size:4.2, lat:43.71, lng:7.26,  faces:["Marie","Lucas"] },
  { id:3,  url:"https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=800&q=80", location:"Lyon",        city:"Lyon",         year:"2022", size:2.1, lat:45.75, lng:4.83,  faces:["Thomas","Marie"] },
  { id:4,  url:"https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=800&q=80", location:"Chartreuse",  city:"Grenoble",     year:"2023", size:5.0, lat:45.19, lng:5.72,  faces:[] },
  { id:5,  url:"https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800&q=80", location:"Bretagne",    city:"Quimper",      year:"2021", size:3.8, lat:47.99, lng:-4.09, faces:["Lucas","Emma"] },
  { id:6,  url:"https://images.unsplash.com/photo-1447752875215-b2761acb3c5d?w=800&q=80", location:"Forêt",       city:"Fontainebleau",year:"2022", size:2.9, lat:48.41, lng:2.70,  faces:[] },
  { id:7,  url:"https://images.unsplash.com/photo-1520962922320-2038eebab146?w=800&q=80", location:"Paris",       city:"Paris",        year:"2026", size:3.1, lat:48.85, lng:2.35,  faces:["Marie","Emma","Thomas"] },
  { id:8,  url:"https://images.unsplash.com/photo-1414609245224-afa02bfb3fda?w=800&q=80", location:"Méditerranée",city:"Marseille",    year:"2025", size:4.8, lat:43.30, lng:5.37,  faces:["Lucas"] },
  { id:9,  url:"https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=800&q=80", location:"Toscane",     city:"Florence",     year:"2024", size:3.3, lat:43.77, lng:11.25, faces:["Marie","Lucas"] },
  { id:10, url:"https://images.unsplash.com/photo-1467269204594-9661b134dd2b?w=800&q=80", location:"Barcelone",   city:"Barcelone",    year:"2025", size:4.1, lat:41.39, lng:2.15,  faces:["Emma"] },
  { id:11, url:"https://images.unsplash.com/photo-1560969184-10fe8719e047?w=800&q=80", location:"Allemagne",   city:"Berlin",       year:"2023", size:2.7, lat:52.52, lng:13.40, faces:["Thomas"] },
  { id:12, url:"https://images.unsplash.com/photo-1533929736458-ca588d08c8be?w=800&q=80", location:"Londres",     city:"Londres",      year:"2024", size:5.2, lat:51.51, lng:-0.13, faces:["Marie","Thomas"] },
];

// Personnes reconnues (simulées — future intégration Vision API)
export const FACE_DATA = {
  Marie:  { color:"#f4845f", initials:"MA" },
  Lucas:  { color:"#5b9bd8", initials:"LU" },
  Emma:   { color:"#b07ad8", initials:"EM" },
  Thomas: { color:"#5cb87a", initials:"TH" },
};

// Partenaires d'impression (affiliation)
export const PRINT_PARTNERS = [
  { name:"CEWE",     desc:"Albums & tirages premium", color:"#e8a000", bg:"#fff8e0", emoji:"🏆" },
  { name:"Cheerz",   desc:"Prints carrés & posters",  color:"#e8637a", bg:"#fff0f3", emoji:"🌸" },
  { name:"Photobox", desc:"Mugs, coussins, toiles",   color:"#5b9bd8", bg:"#f0f5ff", emoji:"🎁" },
];