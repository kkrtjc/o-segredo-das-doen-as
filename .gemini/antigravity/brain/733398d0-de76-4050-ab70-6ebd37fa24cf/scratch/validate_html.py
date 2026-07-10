import re

def validate_html(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        
    stack = []
    errors = []
    
    # Self-closing HTML tags
    self_closing = {
        'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 
        'link', 'meta', 'param', 'source', 'track', 'wbr', 'noscript', 'iframe'
    }
    
    in_script = False
    in_style = False
    in_comment = False
    
    tag_regex = re.compile(r'</?([a-zA-Z0-9:-]+)(\s+[^>]*)?>')
    
    for idx, line in enumerate(lines):
        line_num = idx + 1
        
        # Check comments state
        # Very simplified comment handling
        if '<!--' in line and '-->' not in line:
            in_comment = True
            continue
        if '-->' in line and in_comment:
            in_comment = False
            continue
        if in_comment:
            continue
            
        # Check script/style state
        if '<script' in line.lower():
            in_script = True
        if '</script>' in line.lower():
            in_script = False
            continue
        if in_script:
            continue
            
        if '<style' in line.lower():
            in_style = True
        if '</style>' in line.lower():
            in_style = False
            continue
        if in_style:
            continue
            
        # Ignore comments on single line
        line_clean = re.sub(r'<!--.*?-->', '', line)
        
        # Find tags
        for match in tag_regex.finditer(line_clean):
            tag_str = match.group(0)
            tag_name = match.group(1).lower()
            is_closing = tag_str.startswith('</')
            
            if tag_name in self_closing:
                continue
                
            if is_closing:
                if not stack:
                    errors.append(f"Line {line_num}: Extra closing tag </{tag_name}> found with no opening tag.")
                else:
                    open_tag, open_line = stack.pop()
                    if open_tag != tag_name:
                        errors.append(f"Line {line_num}: Mismatched closing tag </{tag_name}>, expected </{open_tag}> (opened at line {open_line}).")
                        # Keep it popped or try to recover
            else:
                if tag_str.endswith('/>'):
                    continue
                stack.append((tag_name, line_num))
                
    while stack:
        open_tag, open_line = stack.pop()
        errors.append(f"Unclosed tag <{open_tag}> opened at line {open_line}.")
        
    print(f"Total errors: {len(errors)}")
    for error in errors[:40]:
        print(error)

validate_html("C:/Users/JOAO PAULO/Documents/GitHub/o-segredo-das-doen-as/index.html")
