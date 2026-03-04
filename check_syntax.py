import sys

def check_syntax(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            # Simple brace balancer
            braces = 0
            parens = 0
            for i, char in enumerate(content):
                if char == '{': braces += 1
                elif char == '}': braces -= 1
                elif char == '(': parens += 1
                elif char == ')': parens -= 1
                
                if braces < 0:
                    print(f"Error: unmatched closing brace at index {i}")
                    return False
                if parens < 0:
                    print(f"Error: unmatched closing parenthesis at index {i}")
                    return False
            
            if braces != 0:
                print(f"Error: unmatched opening brace (total: {braces})")
                return False
            if parens != 0:
                print(f"Error: unmatched opening parenthesis (total: {parens})")
                return False
            
            print("Syntax seems okay (braces/parens balanced)")
            return True
    except Exception as e:
        print(f"Error reading file: {e}")
        return False

if __name__ == "__main__":
    check_syntax(sys.argv[1])
