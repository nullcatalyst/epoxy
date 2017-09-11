module.exports = {
    "watch": true,
    "sources": "test/templates/**/*.html",
    "outputs": [
        {
            "minify": true,
            "entry": "demo.html",
            "data": {
                "title": "Demo",
                "keywords": ["demo", "test"],
                "description": "description",
                "test":"<br/>"
            }
        }
    ]
};
