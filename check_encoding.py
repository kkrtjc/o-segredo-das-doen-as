
try:
    with open('script.js', 'r', encoding='utf-8') as f:
        content = f.read()
        print("Arquivo lido com sucesso em UTF-8.")
        
    non_ascii = []
    for i, char in enumerate(content):
        if ord(char) > 127:
            # Filtra caracteres aceitáveis (acentuados comuns em PT-BR)
            if char not in "áàãâéêíóõôúçÁÀÃÂÉÊÍÓÕÔÚÇñÑ":
                # Pega um contexto de 20 caracteres ao redor
                start = max(0, i - 10)
                end = min(len(content), i + 10)
                context = content[start:end].replace('\n', ' ')
                non_ascii.append(f"Linha {content[:i].count('\n') + 1}: Char '{char}' (Code {ord(char)}) - Contexto: ...{context}...")

    if non_ascii:
        print(f"Encontrados {len(non_ascii)} caracteres suspeitos:")
        for erro in non_ascii[:20]: # Mostra os primeiros 20
            print(erro)
    else:
        print("Nenhum caractere suspeito encontrado (apenas acentos padrões PT-BR).")

except Exception as e:
    print(f"Erro ao ler arquivo: {e}")
