import datetime
import json
import os
import secrets
import uuid

from flask import make_response, render_template, request, send_from_directory
from werkzeug.security import check_password_hash, generate_password_hash

from app.connections import db
from app.models import Token, User
from app.utils import get_hash, get_user_conf


def register_views(app):
    def static_render_context():
        js_bundle_path = os.path.join(
            app.config["STATIC_DIR"], "js", "dist", "main.bundle.js"
        )
        css_bundle_path = os.path.join(
            app.config["STATIC_DIR"], "css", "dist", "main.css"
        )

        context = {
            "javascript_bundle_hash": get_hash(js_bundle_path),
            "css_bundle_hash": get_hash(css_bundle_path),
        }

        return context

    # static file serving
    @app.route("/login/static/<path:path>")
    def send_files(path):
        return send_from_directory(app.config["STATIC_DIR"], path)

    def is_authenticated(request):
        cookie_token = request.cookies.get("auth_token")
        username = request.cookies.get("auth_username")

        user = User.query.filter(User.username == username).first()

        if user is None:
            return False

        token = (
            Token.query.filter(Token.token == cookie_token)
            .filter(Token.user == user.uuid)
            .first()
        )

        if token is None:
            return False
        else:

            token_creation_limit = datetime.datetime.utcnow() - datetime.timedelta(
                days=app.config["TOKEN_DURATION_HOURS"]
            )

            if token.created > token_creation_limit:
                return True
            else:
                return False

    @app.route("/auth", methods=["GET"])
    def index():

        config_data = get_user_conf()

        if not config_data["AUTH_ENABLED"]:
            return "", 200
        else:
            # validate authentication through token
            if is_authenticated(request):
                return "", 200
            else:
                return "", 401

    @app.route("/login/clear", methods=["GET"])
    def logout():
        resp = make_response(render_template("client_side_redirect.html", url="/"))
        resp.set_cookie("auth_token", "")
        resp.set_cookie("auth_username", "")
        return resp

    def render_login_failed():
        context = static_render_context()
        context["login_failed_reason"] = "Incorrect username or password."

        return render_template("login.html", **context)

    @app.route("/login", methods=["GET", "POST"])
    def login():

        config_data = get_user_conf()

        if not config_data["AUTH_ENABLED"]:
            return make_response(render_template("client_side_redirect.html", url="/"))

        if request.method == "POST":

            username = request.form.get("username")
            password = request.form.get("password")
            token = request.form.get("token")

            user = User.query.filter(User.username == username).first()

            if user is None:
                return render_login_failed()
            else:
                if password is not None:
                    can_login = check_password_hash(user.password_hash, password)
                elif token is not None and user.token_hash is not None:
                    can_login = check_password_hash(user.token_hash, token)
                else:
                    can_login = False

                if can_login:

                    # remove old token if it exists
                    Token.query.filter(Token.user == user.uuid).delete()

                    token = Token(user=user.uuid, token=str(secrets.token_hex(16)))

                    db.session.add(token)
                    db.session.commit()

                    resp = make_response(
                        render_template("client_side_redirect.html", url="/")
                    )
                    resp.set_cookie("auth_token", token.token)
                    resp.set_cookie("auth_username", username)

                    return resp
                else:
                    return render_login_failed()

        else:
            return render_template("login.html", **static_render_context())

    @app.route("/login/admin", methods=["GET", "POST"])
    def admin():

        context = static_render_context()
        data_json = {"users": []}
        return_status = 200

        config_data = get_user_conf()

        if not is_authenticated(request) and config_data["AUTH_ENABLED"]:
            return "", 401

        if request.method == "POST":

            if "username" in request.form:

                username = request.form.get("username")
                password = request.form.get("password")

                user = User.query.filter(User.username == username).first()

                if user is not None:
                    data_json.update({"error": "User already exists."})
                    return_status = 409
                elif len(password) == 0:
                    data_json.update({"error": "Password cannot be empty."})
                    return_status = 409
                else:
                    user = User(
                        username=username,
                        password_hash=generate_password_hash(password),
                        uuid=str(uuid.uuid4()),
                    )

                    db.session.add(user)
                    db.session.commit()

            elif "delete_username" in request.form:
                username = request.form.get("delete_username")

                user = User.query.filter(User.username == username).first()

                if user is not None:
                    if user.is_admin:
                        data_json.update({"error": "Admins cannot be deleted."})
                        return_status = 409
                    else:
                        db.session.delete(user)
                        db.session.commit()

        users = User.query.all()
        for user in users:
            data_json["users"].append({"username": user.username})

        context["data_json"] = json.dumps(data_json)

        return render_template("admin.html", **context), return_status
