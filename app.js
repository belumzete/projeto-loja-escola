
const formulario = document.getElementById("formulario");
const mensagem = document.getElementById("mensagem");
const mensagemLista = document.getElementById("mensagem-lista");
const lista = document.getElementById("lista-produtos");
const campoCategoria = document.getElementById("categoria");
const botaoCadastrar = document.getElementById("botao-cadastrar");
const formCliente = document.getElementById("form-cliente");
const mensagemCliente = document.getElementById("mensagem-cliente");
const selectCliente = document.getElementById("select-cliente");

const formCarrinho = document.getElementById("form-carrinho");
const mensagemCarrinho = document.getElementById("mensagem-carrinho");
const selectProdutoCarrinho = document.getElementById("select-produto-carrinho");
const listaCarrinho = document.getElementById("lista-carrinho");
const valorTotalCarrinho = document.getElementById("valor-total-carrinho");

function mostrarMensagem(el, texto, sucesso) {
  el.textContent = texto;
  el.className = sucesso ? "mensagem sucesso" : "mensagem erro";
}

function formatarMoeda(valor) {
  return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}


async function carregarCategorias() {
  try {
    const resposta = await fetch("/api/categorias");
    const dados = await resposta.json();
    if (!resposta.ok) {
      mostrarMensagem(mensagem, dados.mensagem, false);
      return;
    }
    campoCategoria.innerHTML = '<option value="">Selecione uma categoria</option>';
    for (const categoria of dados) {
      const opcao = document.createElement("option");
      opcao.value = categoria.categoria_id;
      opcao.textContent = categoria.nome;
      campoCategoria.appendChild(opcao);
    }
  } catch (erro) {
    mostrarMensagem(mensagem, "Não foi possível carregar as categorias.", false);
  }
}

async function carregarProdutos() {
  mensagemLista.textContent = "Consultando produtos...";
  try {
    const resposta = await fetch("/api/produtos");
    const produtos = await resposta.json();
    if (!resposta.ok) {
      mensagemLista.textContent = produtos.mensagem;
      return;
    }

    lista.replaceChildren();
    selectProdutoCarrinho.innerHTML = '<option value="">-- Selecione um produto --</option>';

    for (const produto of produtos) {

      const linha = document.createElement("tr");
      const valores = [
        produto.nome,
        produto.categorias ? produto.categorias.nome : "Sem categoria",
        formatarMoeda(produto.preco),
        produto.estoque,
      ];
      for (const valor of valores) {
        const celula = document.createElement("td");
        celula.textContent = valor;
        linha.appendChild(celula);
      }
      lista.appendChild(linha);


      const opcao = document.createElement("option");
      opcao.value = produto.produto_id;
      opcao.textContent = `${produto.nome} (${formatarMoeda(produto.preco)})`;
      selectProdutoCarrinho.appendChild(opcao);
    }
    mensagemLista.textContent = produtos.length === 0 ? "Nenhum produto cadastrado." : "Lista atualizada.";
  } catch (erro) {
    mensagemLista.textContent = "Não foi possível atualizar a lista.";
  }
}

async function cadastrarProduto(evento) {
  evento.preventDefault();
  botaoCadastrar.disabled = true;
  mostrarMensagem(mensagem, "Enviando dados...", true);

  const produto = {
    nome: document.getElementById("nome").value,
    categoria_id: campoCategoria.value,
    preco: document.getElementById("preco").value,
    estoque: document.getElementById("estoque").value,
  };

  try {
    const resposta = await fetch("/api/produtos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(produto),
    });
    const dados = await resposta.json();
    mostrarMensagem(mensagem, dados.mensagem, resposta.ok);
    if (resposta.ok) {
      formulario.reset();
      await carregarProdutos();
    }
  } catch (erro) {
    mostrarMensagem(mensagem, "Não foi possível confirmar o cadastro.", false);
  } finally {
    botaoCadastrar.disabled = false;
  }
}


async function carregarClientes() {
  try {
    const resposta = await fetch("/api/clientes");
    const clientes = await resposta.json();
    if (!resposta.ok) return;

    selectCliente.innerHTML = '<option value="">-- Selecione um cliente --</option>';
    for (const c of clientes) {
      const opcao = document.createElement("option");
      opcao.value = c.cliente_id;
      opcao.textContent = `${c.nome} (${c.email})`;
      selectCliente.appendChild(opcao);
    }
  } catch (erro) {
    mostrarMensagem(mensagemCliente, "Erro ao carregar lista de clientes.", false);
  }
}

async function cadastrarCliente(evento) {
  evento.preventDefault();

  const nome = document.getElementById("cliente-nome").value.trim();
  const email = document.getElementById("cliente-email").value.trim();
  const telefone = document.getElementById("cliente-telefone").value.trim();

  if (!nome || !email) {
    mostrarMensagem(mensagemCliente, "Nome e E-mail são obrigatórios.", false);
    return;
  }

  try {
    const resposta = await fetch("/api/clientes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome, email, telefone }),
    });
    const dados = await resposta.json();

    mostrarMensagem(mensagemCliente, dados.mensagem, resposta.ok);
    if (resposta.ok) {
      formCliente.reset();
      await carregarClientes();
    }
  } catch (erro) {
    mostrarMensagem(mensagemCliente, "Erro de conexão ao cadastrar cliente.", false);
  }
}


async function carregarCarrinho() {
  const clienteId = selectCliente.value;
  if (!clienteId) {
    listaCarrinho.innerHTML = '<tr><td colspan="5" class="texto-centro">Selecione um cliente.</td></tr>';
    valorTotalCarrinho.textContent = formatarMoeda(0);
    return;
  }

  try {
    const resposta = await fetch(`/api/carrinho?cliente_id=${clienteId}`);
    const itens = await resposta.json();

    if (!resposta.ok) {
      mostrarMensagem(mensagemCarrinho, itens.mensagem, false);
      return;
    }

    listaCarrinho.replaceChildren();
    let totalGeral = 0;

    if (itens.length === 0) {
      listaCarrinho.innerHTML = '<tr><td colspan="5" class="texto-centro">Carrinho vazio.</td></tr>';
    } else {
      for (const item of itens) {
        const prod = item.produtos || {};
        const preco = Number(prod.preco || 0);
        const subtotal = preco * item.quantidade;
        totalGeral += subtotal;

        const tr = document.createElement("tr");

        const tdNome = document.createElement("td");
        tdNome.textContent = prod.nome || "Item indisponível";

        const tdQtd = document.createElement("td");
        tdQtd.textContent = item.quantidade;

        const tdPreco = document.createElement("td");
        tdPreco.textContent = formatarMoeda(preco);

        const tdSubtotal = document.createElement("td");
        tdSubtotal.textContent = formatarMoeda(subtotal);

        const tdAcao = document.createElement("td");
        const btnRemover = document.createElement("button");
        btnRemover.textContent = "Remover";
        btnRemover.className = "secundario";
        btnRemover.type = "button";
        btnRemover.addEventListener("click", () => removerItemCarrinho(item.carrinho_id));

        tdAcao.appendChild(btnRemover);
        tr.append(tdNome, tdQtd, tdPreco, tdSubtotal, tdAcao);
        listaCarrinho.appendChild(tr);
      }
    }

    valorTotalCarrinho.textContent = formatarMoeda(totalGeral);
  } catch (erro) {
    mostrarMensagem(mensagemCarrinho, "Não foi possível carregar o carrinho.", false);
  }
}

async function adicionarAoCarrinho(evento) {
  evento.preventDefault();

  const clienteId = selectCliente.value;
  const produtoId = selectProdutoCarrinho.value;
  const quantidade = parseInt(document.getElementById("carrinho-quantidade").value, 10);

  if (!clienteId) {
    mostrarMensagem(mensagemCarrinho, "Selecione um cliente primeiro.", false);
    return;
  }
  if (!produtoId) {
    mostrarMensagem(mensagemCarrinho, "Selecione um produto.", false);
    return;
  }
  if (isNaN(quantidade) || quantidade <= 0) {
    mostrarMensagem(mensagemCarrinho, "A quantidade deve ser maior que zero.", false);
    return;
  }

  try {
    const resposta = await fetch("/api/carrinho", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cliente_id: clienteId,
        produto_id: produtoId,
        quantidade: quantidade,
      }),
    });
    const dados = await resposta.json();

    mostrarMensagem(mensagemCarrinho, dados.mensagem, resposta.ok);
    if (resposta.ok) {
      document.getElementById("carrinho-quantidade").value = "1";
      await carregarCarrinho();
    }
  } catch (erro) {
    mostrarMensagem(mensagemCarrinho, "Erro ao adicionar produto ao carrinho.", false);
  }
}

async function removerItemCarrinho(carrinhoId) {
  try {
    const resposta = await fetch(`/api/carrinho/${carrinhoId}`, { method: "DELETE" });
    const dados = await resposta.json();

    mostrarMensagem(mensagemCarrinho, dados.mensagem, resposta.ok);
    if (resposta.ok) {
      await carregarCarrinho();
    }
  } catch (erro) {
    mostrarMensagem(mensagemCarrinho, "Erro ao remover item do carrinho.", false);
  }
}


formulario.addEventListener("submit", cadastrarProduto);
formCliente.addEventListener("submit", cadastrarCliente);
formCarrinho.addEventListener("submit", adicionarAoCarrinho);
selectCliente.addEventListener("change", carregarCarrinho);
document.getElementById("botao-atualizar").addEventListener("click", carregarProdutos);

carregarCategorias();
carregarProdutos();
carregarClientes();