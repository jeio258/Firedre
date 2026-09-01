const PBKDF2_ITERATIONS = 100000;
const SALT_LENGTH = 16;
const IV_LENGTH = 12;
const KEY_LENGTH = 32;
const TAG_LENGTH = 16;

const encoder = new TextEncoder();

export async function encryptContent(
	html: string,
	password: string,
	_slug: string,
): Promise<string> {
	const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
	const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

	const keyMaterial = await crypto.subtle.importKey(
		"raw",
		encoder.encode(password),
		"PBKDF2",
		false,
		["deriveBits", "deriveKey"],
	);
	const key = await crypto.subtle.deriveKey(
		{ name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
		keyMaterial,
		{ name: "AES-GCM", length: KEY_LENGTH * 8 },
		false,
		["encrypt"],
	);

	const combined = await crypto.subtle.encrypt(
		{ name: "AES-GCM", iv },
		key,
		encoder.encode(html),
	);
	const combinedBuf = new Uint8Array(combined);
	const authTag = combinedBuf.slice(combinedBuf.length - TAG_LENGTH);
	const ciphertext = combinedBuf.slice(0, combinedBuf.length - TAG_LENGTH);

	const out = new Uint8Array(SALT_LENGTH + IV_LENGTH + TAG_LENGTH + ciphertext.length);
	out.set(salt, 0);
	out.set(iv, SALT_LENGTH);
	out.set(authTag, SALT_LENGTH + IV_LENGTH);
	out.set(ciphertext, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

	let bin = "";
	for (let i = 0; i < out.length; i++) bin += String.fromCharCode(out[i]);
	return btoa(bin);
}
