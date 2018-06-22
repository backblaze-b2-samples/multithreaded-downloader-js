from flask import Flask, send_from_directory

app = Flask(__name__)

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/<path:path>')
def files(path):
    return send_from_directory('.', path)

if __name__ == '__main__':
    app.run('0.0.0.0', debug=True)