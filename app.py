import os
from decimal import Decimal, InvalidOperation
import requests
from dotenv import load_dotenv
from flask import Flask, jsonify, render_template, request


load_dotenv()

app = Flask(__name__)
SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SECRET_KEY", "")


def acessar_supabase(metodo, tabela, parametros=None, dados=None):
    resposta = requests.request(
        metodo,
        f"{SUPABASE_URL}/rest/v1/{tabela}",
        headers={
            "apikey": SUPABASE_SECRET_KEY,
            "Authorization": f"Bearer {SUPABASE_SECRET_KEY}",
            "content-type": "application/json",
            "prefer": "return=representation",
        },
        params=parametros,
        json=dados,
        timeout=10,
    )

    resposta.raise_for_status()
    if resposta.status_code == 204 or not resposta.content:
        return []
    return resposta.json()


@app.before_request
def conferir_configuracao():
    if request.path.startswith("/api/"):
        if not SUPABASE_URL or not SUPABASE_SECRET_KEY:
            return jsonify(mensagem="configure a url e a chave do supabase"), 503


@app.get("/")
def inicio():
    return render_template("index.html")


@app.get("/api/categorias")
def listar_catgorias():
    categorias = acessar_supabase(
        "GET",
        "categorias",
        {"select": "categoria_id,nome", "order": "nome.asc"},
    )
    return jsonify(categorias)

@app.get("/api/produtos")
def listar_produto():
    produtos = acessar_supabase(
        "GET",
        "produtos",
        {"select": "produto_id, nome, preco, estoque, categorias(nome)", "order": "produto_id.desc"},
    )
    return jsonify(produtos)


@app.post("/api/produtos")
def cadastrar_produto():
    dados = request.get_json(silent=True)
    if not isinstance(dados, dict):
        return jsonify(mensagem="Envie um objeto JSON válido."), 400

    campos = ["nome", "preco", "estoque", "categoria_id"]
    for campo in campos:
        if dados.get(campo) is None or not isinstance(dados.get(campo), str):
            return jsonify(mensagem=f"O campo {campo} deve ser preenchido com texto"), 400

    nome = dados["nome"].strip()
    texto_preco = dados["preco"].strip().replace(",", ".")
    texto_estoque = dados["estoque"].strip()
    texto_categoria = dados["categoria_id"].strip()

    if len(nome) < 3 or len(nome) > 80:
        return jsonify(mensagem="Nome deve ter de 3 a 80 caracteres"), 400

    try:
        preco = Decimal(texto_preco)
        estoque = int(texto_estoque)
        categoria_id = int(texto_categoria)
    except (InvalidOperation, ValueError):
        return jsonify(mensagem="Informe preço numérico, estoque inteiro e categoria válida!"), 400

    if not preco.is_finite() or preco <= 0 or preco > Decimal("999999.99"):
        return jsonify(mensagem="o preço deve estar entre R$ 0,01 e R$ 999999,99"), 400
    if preco != preco.quantize(Decimal("0.01")):
        return jsonify(mensagem="o preço deve ter no máximo duas casas decimais"), 400
    if estoque < 0 or estoque > 1000000:
        return jsonify(mensagem="o Estoque deve estar entre 0 e 1000000 unidades"), 400
    if categoria_id <= 0 or categoria_id > 2147483647:
        return jsonify(mensagem="selecione uma categoria valida"), 400

    categorias = acessar_supabase(
        "GET",
        "categorias",
        {"select": "categoria_id", "categoria_id": f"eq.{categoria_id}"},
    )
    if not categorias:
        return jsonify(mensagem="a categoria informada não existe "), 400

    acessar_supabase(
        "POST",
        "produtos",
        dados={
            "nome": nome,
            "preco": str(preco),
            "estoque": estoque,
            "categoria_id": categoria_id,
        },
    )

    return jsonify(mensagem="produto cadastrado com sucesso"), 201


@app.get("/api/clientes")
def listar_clientes():
    clientes = acessar_supabase(
        "GET",
        "clientes",
        {"select": "cliente_id, nome, email, telefone", "order": "nome.asc"},
    )
    return jsonify(clientes)


@app.post("/api/clientes")
def cadastrar_cliente():
    dados = request.get_json(silent=True)
    if not isinstance(dados, dict):
        return jsonify(mensagem="Envie um objeto JSON válido."), 400

    nome = str(dados.get("nome", "")).strip()
    email = str(dados.get("email", "")).strip()
    telefone = str(dados.get("telefone", "")).strip() if dados.get("telefone") else None

    if not nome or not email:
        return jsonify(mensagem="Nome e e-mail são obrigatórios."), 400

    novo_cliente = {
        "nome": nome,
        "email": email,
        "telefone": telefone,
    }

    acessar_supabase("POST", "clientes", dados=novo_cliente)
    return jsonify(mensagem="Cliente cadastrado com sucesso!"), 201


@app.get("/api/carrinho")
def consultar_carrinho():
    cliente_id = request.args.get("cliente_id")
    if not cliente_id:
        return jsonify(mensagem="Informe o ID do cliente."), 400

    itens = acessar_supabase(
        "GET",
        "carrinho",
        {
            "select": "carrinho_id, cliente_id, produto_id, quantidade, produtos(nome, preco)",
            "cliente_id": f"eq.{cliente_id}",
            "order": "carrinho_id.asc",
        },
    )
    return jsonify(itens)


@app.post("/api/carrinho")
def adicionar_carrinho():
    dados = request.get_json(silent=True)
    if not isinstance(dados, dict):
        return jsonify(mensagem="Envie um objeto JSON válido."), 400

    try:
        cliente_id = int(dados.get("cliente_id", 0))
        produto_id = int(dados.get("produto_id", 0))
        quantidade = int(dados.get("quantidade", 0))
    except (TypeError, ValueError):
        return jsonify(mensagem="IDs e quantidade devem ser números inteiros."), 400

    if cliente_id <= 0 or produto_id <= 0:
        return jsonify(mensagem="Selecione um cliente e um produto válidos."), 400

    if quantidade <= 0:
        return jsonify(mensagem="A quantidade deve ser maior que zero."), 400

    existente = acessar_supabase(
        "GET",
        "carrinho",
        {
            "select": "carrinho_id",
            "cliente_id": f"eq.{cliente_id}",
            "produto_id": f"eq.{produto_id}",
        },
    )
    if existente:
        return jsonify(mensagem="Este produto já está no carrinho deste cliente."), 400

    novo_item = {
        "cliente_id": cliente_id,
        "produto_id": produto_id,
        "quantidade": quantidade,
    }

    acessar_supabase("POST", "carrinho", dados=novo_item)
    return jsonify(mensagem="Produto adicionado ao carrinho com sucesso!"), 201


@app.delete("/api/carrinho/<int:carrinho_id>")
def remover_carrinho(carrinho_id):
    if carrinho_id <= 0:
        return jsonify(mensagem="ID do item inválido."), 400

    acessar_supabase("DELETE", "carrinho", {"carrinho_id": f"eq.{carrinho_id}"})
    return jsonify(mensagem="Item removido do carrinho com sucesso."), 200


@app.errorhandler(requests.exceptions.RequestException)
def tratar_erro_supabase(erro):
    app.logger.warning("falha ao acessar o supabase: %s", type(erro).__name__)

    if isinstance(erro, requests.exceptions.HTTPError):
        try:
            detalhe = erro.response.json()
        except ValueError:
            detalhe = {}

        if isinstance(detalhe, dict):
            codigo = detalhe.get("code")
            if codigo == "23505":
                return jsonify(mensagem="Registro duplicado no sistema."), 409
            if codigo == "23503":
                return jsonify(mensagem="Registro relacionado não foi encontrado."), 400
            if codigo == "23514":
                return jsonify(mensagem="os dados não atendem às regras do banco"), 400

    return jsonify(mensagem="não foi possível acessar o banco, tente novamente"), 503


@app.errorhandler(500)
def tratar_erro_inesperado(erro):
    app.logger.exception("erro interno inesperado: %s", erro)
    return jsonify(mensagem="ocorreu uma falha interna"), 500


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5000, debug=False)