from flask import Flask, request
import requests
from geopy.distance import geodesic
import smtplib

app = Flask(__name__)

@app.route('/check_proximity', methods=['POST'])
def check_proximity():
    data = request.json
    ship_positions = data['ship_positions']  # Assume ship_positions is a list of dicts with lat and lon keys

    puerto_rico_coords = (18.2208, -66.5901)
    nearby_ships = []

    for ship in ship_positions:
        ship_coords = (ship['lat'], ship['lon'])
        distance_km = geodesic(puerto_rico_coords, ship_coords).kilometers

        if distance_km < 50:  # Assuming 50 km as the range
            nearby_ships.append(ship)

    if nearby_ships:
        send_email(nearby_ships)

    return "Proximity check complete", 200

def send_email(nearby_ships):
    with smtplib.SMTP('smtp.gmail.com', 587) as server:
        server.login("orlyf23@gmail.com", "Apolo236@gmail")
        subject = "Ships near Puerto Rico"
        body = "The following ships are within 50 km of Puerto Rico:\n" + \
               '\n'.join(f"{ship['name']} at {ship['lat']}, {ship['lon']}" for ship in nearby_ships)
        msg = f'Subject: {subject}\n\n{body}'
        server.sendmail("orlyf23@gmail.com", "orlando.rodriguez.nieto@linde.com", msg)

if __name__ == '__main__':
    app.run(debug=True)
