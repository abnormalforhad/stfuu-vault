import { useEffect, useMemo, useState } from 'react'
import { AppConfig, UserSession, showConnect, openContractCall } from '@stacks/connect'
import {
  AnchorMode, PostConditionMode, bufferCV, callReadOnlyFunction, // FIXED
  contractPrincipalCV, cvToHex, listCV, noneCV, principalCV, someCV, uintCV
} from '@stacks/transactions'
import { StacksMainnet, StacksTestnet, StacksMocknet } from '@stacks/network' // FIXED
import './App.css' // This grabs your Glassmorphism styles

// --- CONFIGURATION ---
const appConfig = new AppConfig(['store_write', 'publish_data'])
const userSession = new UserSession({ appConfig })
const appDetails = { name: 'STFUU Vault', icon: 'https://stacks.co/favicon.ico' }
const defaultContractName = 'multisig-v3'
const defaultTokenName = 'mock-token-v3'

// --- HELPER FUNCTIONS ---
const normalizeLines = (value: string) => value.split(/[\n,]/g).map((item) => item.trim()).filter(Boolean)
const hexToBytes = (hex: string) => {
  const clean = hex.replace(/^0x/i, '').trim()
  if (!/^[\da-fA-F]+$/.test(clean) || clean.length % 2 !== 0) return null
  const bytes = new Uint8Array(clean.length / 2)
  for (let i = 0; i < clean.length; i += 2) bytes[i / 2] = Number.parseInt(clean.slice(i, i + 2), 16)
  return bytes
}

function App() {
  const [userData, setUserData] = useState<null | ReturnType<typeof userSession.loadUserData>>(null)
  const [sessionReady, setSessionReady] = useState(false)
  const [networkMode, setNetworkMode] = useState<'mainnet' | 'testnet' | 'devnet'>('testnet')
  const [contractAddress, setContractAddress] = useState('SP1G4ZDXED8XM2XJ4Q4GJ7F4PG4EJQ1KKXRCD0S3K')
  const [contractName, setContractName] = useState(defaultContractName)
  const [initSigners, setInitSigners] = useState('')
  const [status, setStatus] = useState('')

  useEffect(() => {
    if (userSession.isSignInPending()) {
      userSession.handlePendingSignIn().then((userData) => {
        setUserData(userData);
      });
    } else if (userSession.isUserSignedIn()) {
      setUserData(userSession.loadUserData());
    }
    setSessionReady(true);
  }, []);

  const network = useMemo(() => {
    if (networkMode === 'mainnet') return new StacksMainnet();
    if (networkMode === 'testnet') return new StacksTestnet();
    return new StacksMocknet();
  }, [networkMode]);

  const connectWallet = () => {
    showConnect({
      userSession,
      appDetails,
      onFinish: () => setUserData(userSession.loadUserData()),
      onCancel: () => setStatus('Connection cancelled'),
    });
  };

  const disconnectWallet = () => {
    userSession.signUserOut(window.location.origin);
    setUserData(null);
  };

  return (
    <div className="page">
      <header className="hero">
        <div>
          <p className="eyebrow">STFUU VAULT PROTOCOL</p>
          <h1>Secure. Fast. High Impact.</h1>
          <p className="lede">The ultimate multisig solution for Stacks. Powered by the STFUU Protocol.</p>
        </div>
        <div className="wallet-card">
          <div className="wallet-status">
             <span className={userData ? 'dot online' : 'dot offline'} />
             <p>{userData ? 'Connected' : 'Disconnected'}</p>
          </div>
          {userData ? (
            <button className="btn secondary" onClick={disconnectWallet}>Disconnect</button>
          ) : (
            <button className="btn" onClick={connectWallet}>Connect Wallet</button>
          )}
        </div>
      </header>

      <section className="grid">
        <div className="panel">
          <h2>Deploy & Initialize</h2>
          <p className="hint">Configure your vault settings below.</p>
          <div className="field">
            <label>Contract Address</label>
            <input value={contractAddress} onChange={(e) => setContractAddress(e.target.value)} />
          </div>
          <div className="field">
             <label>Signers (One per line)</label>
             <textarea rows={4} value={initSigners} onChange={(e) => setInitSigners(e.target.value)} placeholder="ST..." />
          </div>
          <button className="btn">Initialize Vault</button>
        </div>
        
        <div className="panel">
          <h2>Active Vaults</h2>
          <p className="hint">View your active assets and pending transactions.</p>
          <div className="status">
             <p className="info">Connect wallet to view vaults.</p>
          </div>
        </div>
      </section>
    </div>
  )
}

export default App