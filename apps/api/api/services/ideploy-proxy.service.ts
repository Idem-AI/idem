import jwt from 'jsonwebtoken';
import axios from 'axios';

const IDEPLOY_URL = process.env.IDEPLOY_URL || 'https://ideploy.idem.africa';
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRATION_MINUTES = parseInt(process.env.JWT_EXPIRATION || '10', 10);

if (!JWT_SECRET) {
  console.warn('[IDeployProxy] JWT_SECRET is not set — /ideploy/summary will fail');
}

export interface IDeployUserPayload {
  uid: string;
  email: string;
  name: string;
}

function generateToken(user: IDeployUserPayload): string {
  if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is not configured');
  }
  return jwt.sign(
    { email: user.email, name: user.name, role: 'member' },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRATION_MINUTES * 60 }
  );
}

export async function fetchIDeploySummary(user: IDeployUserPayload): Promise<unknown> {
  const token = generateToken(user);

  const response = await axios.get(`${IDEPLOY_URL}/api/v1/idem/summary`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    timeout: 10000,
  });

  return response.data;
}
