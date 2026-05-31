// Middleware de autenticação JWT
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'troque-isso-em-producao';

/**
 * Verifica o JWT no header Authorization.
 * Anexa o payload decodificado em req.usuario.
 */
function autenticar(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ erro: 'Token de autenticação ausente' });
  }

  const token = auth.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.usuario = payload;
    next();
  } catch (err) {
    return res.status(401).json({ erro: 'Token inválido ou expirado' });
  }
}

/**
 * Exige um papel específico. Uso: exigirPapel('ADMIN', 'OPERADOR')
 */
function exigirPapel(...papeis) {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({ erro: 'Não autenticado' });
    }
    if (!papeis.includes(req.usuario.papel)) {
      return res.status(403).json({ erro: 'Acesso negado para este papel' });
    }
    next();
  };
}

function gerarToken(payload, expiresIn = '7d') {
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

module.exports = { autenticar, exigirPapel, gerarToken };
