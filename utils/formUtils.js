// ✅ formUtils.js (with full support for Google Forms checkbox/radio)

export function getAllFormInputs() {
  const isVisible = el => {
    const style = window.getComputedStyle(el);
    return style && style.visibility !== "hidden" && style.display !== "none" && el.offsetParent !== null;
  };

  const inputElements = Array.from(document.querySelectorAll("input, select, textarea"));
  const customDropdowns = Array.from(document.querySelectorAll('[role="combobox"], .js-dropdown-select, .quantumWizMenuPaperselectEl'));

  const allInputs = [...inputElements, ...customDropdowns].filter(el =>
    isVisible(el) &&
    !el.disabled &&
    !el.readOnly &&
    !["hidden", "submit", "button", "reset"].includes(el.type)
  );

  const groupedInputs = new Map();

  allInputs.forEach(el => {
    const type = el.type?.toLowerCase();
    const name = el.name || el.id || el.getAttribute("aria-label") || el.getAttribute("placeholder") || "";

    if (["radio", "checkbox"].includes(type)) {
      if (!groupedInputs.has(name)) groupedInputs.set(name, el);
    } else {
      groupedInputs.set(el, el);
    }
  });

  // ✅ Group Google Form radios/checkboxes by their container
  const gformGroups = Array.from(document.querySelectorAll('[role="listitem"]')).filter(isVisible);
  gformGroups.forEach(container => {
    const roleInputs = container.querySelectorAll('[role="radio"], [role="checkbox"]');
    if (roleInputs.length > 0) {
      groupedInputs.set(container, container);
    }
  });

  return [...groupedInputs.values()];
}

export function getFieldData(inputs) {
  const seen = new Set();

  return inputs.map(field => {
    let label = getFieldLabel(field);
    let options = [];

    const normalize = str => str?.toLowerCase().replace(/[^\w\s]/gi, '').trim();

    // ✅ 1. Label via standard HTML
    if (field.labels && field.labels.length > 0) {
      label = field.labels[0].innerText?.trim();
    }

    if (!label) label = field.getAttribute("aria-label");
    if (!label && field.placeholder) label = field.placeholder.trim();

    // ✅ 2. Google Forms label logic (for div containers)
    const labelEl = field.querySelector?.('.M7eMe, .MocG8c, .Qr7Oae');
    if (!label && labelEl) label = labelEl.textContent.trim();

    // ✅ 3. Role-based field (radio/checkbox/select inside group)
    const optionsRaw = field.querySelectorAll?.('[role="radio"], [role="checkbox"], option');
    if (optionsRaw && optionsRaw.length) {
      options = Array.from(optionsRaw).map(el =>
        el.textContent?.trim() || el.innerText?.trim()
      ).filter(Boolean);
    }

    // ✅ 4. Final fallback label from ancestor
    if (!label) {
      const questionBlock = field.closest?.('[role="listitem"]');
      const fallbackLabel = questionBlock?.querySelector('.M7eMe, .MocG8c, .Qr7Oae');
      if (fallbackLabel) label = fallbackLabel.textContent.trim();
    }

    // ✅ 5. Last resort fallback
    if (!label) {
      label = field.name || field.id || "this field";
    }

    // ✅ Deduplicate labels
    const base = normalize(label);
    if (seen.has(base)) {
      label += ` #${Math.floor(Math.random() * 1000)}`;
    }
    seen.add(base);

    return { label, options };
  });
}

export function getFieldLabel(field) {
  // 1. <label for="id"> tag or label wrapper
  if (field.labels?.length) {
    return field.labels[0].innerText.trim();
  }

  // 2. aria-labelledby → get text from referenced ID
  const labelledBy = field.getAttribute("aria-labelledby");
  if (labelledBy) {
    const ref = document.getElementById(labelledBy);
    if (ref) return ref.textContent.trim();
  }

  // 3. aria-label
  const ariaLabel = field.getAttribute("aria-label");
  if (ariaLabel) return ariaLabel.trim();

  // 4. fieldset > legend
  const fs = field.closest('fieldset');
  if (fs) {
    const legend = fs.querySelector('legend');
    if (legend) return legend.textContent.trim();
  }

  // 5. Google Forms specific (already exists)
  const gformLabel = field.querySelector?.('.M7eMe, .MocG8c, .Qr7Oae');
  if (gformLabel) return gformLabel.textContent.trim();

  // 6. Table layout or label in previous sibling
  const tableLabel = findTableOrSiblingLabel(field);
  if (tableLabel) return tableLabel;

  // 7. Placeholder (only if no better label)
  if (field.placeholder) return field.placeholder.trim();

  // 8. Title attribute (optional)
  if (field.title) return field.title.trim();

  // 9. Fallback to name/id
  return humanizeFallback(field.name || field.id || 'this field');
}

function findTableOrSiblingLabel(field) {
  // Table-based: use adjacent <td>/<th>
  const cell = field.closest('td, th');
  if (cell) {
    const row = cell.parentElement;
    const idx = Array.from(row.children).indexOf(cell);
    if (idx > 0) {
      const prev = row.children[idx - 1];
      if (prev && prev.textContent.trim()) {
        return prev.textContent.trim();
      }
    }
  }

  // Inline sibling
  const prev = field.previousElementSibling;
  if (prev && prev.textContent.trim()) {
    return prev.textContent.trim();
  }

  // Ancestor check
  const parent = field.parentElement;
  if (parent && parent.textContent.trim().length < 100 && !parent.querySelector('input, select, textarea')) {
    return parent.textContent.trim();
  }

  return null;
}

function humanizeFallback(str) {
  return str
    .replace(/[_\-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
}

export function isSkippable(field) {
  return field.type === 'hidden' || field.disabled || field.readOnly;
}

export function isValid(value, field) {
  if (!value || !value.trim()) return false;

  const type = field?.type?.toLowerCase() || '';
  switch (type) {
    case "email": return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    case "date": return !isNaN(Date.parse(value));
    default: return true;
  }
}

export async function fillField(field, value, label, prompt) {
  console.log("fill Field()");
  const { speak, delay, listenWithRetry } = await import('./voiceUtils.js');
  const { extractUsefulInput } = await import('./llmUtils.js');
  const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();

  let attempts = 0;

  while (true) {
    let cleanedValue = value;

    // 1. First attempt → clean with LLM
    if (attempts === 0 && value) {
      cleanedValue = await extractUsefulInput(value, label, field);
    }

    // 2. Fill the field
    await applyFieldValue(field, cleanedValue, label, prompt);

    // 3. Check for any validation error
    const error = getValidationError(field);
    if (!error) break;

    console.warn(`❌ Validation error: ${error}`);

    // 4. Speak the validation error to user
    await speak(`Validation error: ${error}`);
    await delay(300);

    // 5. Retry asking for input
    await speak(prompt);
    value = await listenWithRetry(recognition, label, field, 2);
    attempts++;
  }
}

async function applyFieldValue(field, value, label, prompt) {
  const type = field.type?.toLowerCase();
  const role = field.getAttribute("role");
  const fieldType = role || type || field.tagName.toLowerCase();

  switch (fieldType) {
    case 'checkbox':
    case 'radio':
      await fillRadioOrCheckboxGroup(field, value, label, prompt);
      break;
    case 'select':
    case 'select-one':
    case 'select-multiple':
      await fillSelectField(field, value);
      break;
    case 'date': {
      const { formatDateInput } = await import('./llmUtils.js');
      const formatted = await formatDateInput(value);
      const match = formatted.match(/\d{4}-\d{2}-\d{2}/);
      field.value = match ? match[0] : '';
      break;
    }
    case 'email':
      field.value = value.replace(/\s+/g, '').toLowerCase(); break;
    case 'tel':
    case 'phone':
      field.value = value.replace(/[^\d\+\-\(\)\s]/g, ''); break;
    default:
      if (field.type === 'color') {
        const COLOR_MAP = {
          red: "#ff0000", green: "#00ff00", blue: "#0000ff", black: "#000000",
          white: "#ffffff", yellow: "#ffff00", orange: "#ffa500", pink: "#ffc0cb",
          purple: "#800080", gray: "#808080"
        };
        const hex = COLOR_MAP[value.toLowerCase()] || "#000000";
        field.value = hex;
      } else {
        await fillTextFieldSimulated(field, value);
      }
  }

  field.dispatchEvent(new Event('change', { bubbles: true }));
}

export async function fillTextFieldSimulated(field, value) {
  const { delay } = await import('./voiceUtils.js');
  field.focus();
  field.placeholder = "typing...";
  field.value = "";
  for (const char of value) {
    field.value += char;
    field.dispatchEvent(new Event("input", { bubbles: true }));
    await delay(30);
  }
  field.dispatchEvent(new Event("change", { bubbles: true }));
  field.placeholder = "";
}

export async function fillRadioOrCheckboxGroup(field, spokenValue, label, prompt = "") {
  const { speak, delay, listenWithRetry } = await import('./voiceUtils.js');
  const normalize = txt => txt?.toLowerCase().replace(/[^\w\s]/gi, '').trim();
  const role = field.getAttribute("role");

  if (role === "radio" || role === "checkbox") {
    const question = field.closest('[role="listitem"]');
    const optionEls = question?.querySelectorAll(`[role="${role}"]`) || [];

    const options = Array.from(optionEls).map(el => ({
      element: el,
      label: el.textContent.trim()
    }));

    if (!spokenValue) {
      const allOptionsText = options.map(o => o.label).join(", ");
      await speak(prompt || `${label} options are: ${allOptionsText}. Please say your choice.`);
      await delay(400);
      spokenValue = await listenWithRetry(new (window.SpeechRecognition || window.webkitSpeechRecognition)(), label, field, 3);
    }

    const cleanedInput = normalize(spokenValue);
    const match = options.find(opt =>
      normalize(opt.label) === cleanedInput || cleanedInput.includes(normalize(opt.label))
    );

    if (match) {
      match.element.click();
      console.log(`✅ Google Form ${role} selected:`, match.label);
    } else {
      console.warn(`⚠️ No match found for Google Form ${role}:`, spokenValue);
    }
    return;
  }

  // ✅ Normal input[type=radio|checkbox]
  const type = field.type;
  const name = field.name;
  const group = Array.from(document.querySelectorAll(`input[type=${type}][name="${name}"]`));
  const options = group.map(opt => {
    const optLabel = opt.labels?.[0]?.innerText || opt.value;
    return { element: opt, label: optLabel, value: opt.value };
  });

  if (!spokenValue) {
    const allOptionsText = options.map(o => o.label).join(", ");
    await speak(prompt || `${label} options are: ${allOptionsText}. Please say your choice.`);
    await delay(400);
    spokenValue = await listenWithRetry(new (window.SpeechRecognition || window.webkitSpeechRecognition)(), label, field, 3);
  }

  if (type === "checkbox" && group.length === 1) {
    const val = normalize(spokenValue);
    group[0].checked = val.includes("yes") || val.includes("check") || val.includes("on") || val.includes("subscribe");
    group[0].dispatchEvent(new Event("change", { bubbles: true }));
    console.log(`✅ Checkbox "${label}" set to: ${group[0].checked}`);
    return;
  }

  const cleanedInput = normalize(spokenValue);
  const matched = options.find(opt =>
    normalize(opt.label) === cleanedInput || normalize(opt.value) === cleanedInput
  );

  if (matched) {
    matched.element.checked = true;
    matched.element.dispatchEvent(new Event("change", { bubbles: true }));
    console.log(`✅ ${type} selected:`, matched.label || matched.value);
  } else {
    console.warn(`⚠️ No match found for ${type}:`, spokenValue);
  }
}

export async function fillSelectField(selectField, spokenValue) {
  console.log(`📋 Processing dropdown with ${selectField.options.length} options`);
  const options = Array.from(selectField.options);
  const spokenLower = spokenValue.toLowerCase().trim();

  for (let option of options) {
    if (option.text.toLowerCase() === spokenLower || option.value.toLowerCase() === spokenLower) {
      selectField.value = option.value;
      selectField.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }
  }

  for (let option of options) {
    if (option.text.toLowerCase().includes(spokenLower) || spokenLower.includes(option.text.toLowerCase())) {
      selectField.value = option.value;
      selectField.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }
  }

  try {
    const { findBestSelectOption } = await import('./llmUtils.js');
    const bestMatch = await findBestSelectOption(spokenValue, options);
    if (bestMatch) {
      selectField.value = bestMatch.value;
      selectField.dispatchEvent(new Event("change", { bubbles: true }));
    } else {
      const { speak } = await import('./voiceUtils.js');
      await speak(`Sorry, ${spokenValue} is not in the list of options for ${selectField.name || "this field"}.`);
      console.warn(`⚠️ No match found for: ${spokenValue}`);
    }
  } catch (error) {
    console.error("❌ Error in AI-assisted option matching:", error);
  }
}

export function isFieldValid(field) {
  return !getValidationError(field);
}

export function getValidationError(field) {
  // ✅ 1. Native HTML5 validation
  if (!field.checkValidity?.() && field.validationMessage) {
    return field.validationMessage;
  }

  // ✅ 2. Custom UI red error detection
  const parent = field.closest('[role="listitem"], .form-group, .form-row, .field-container, div');

  if (parent) {
    // Look for red-colored LI or DIV with meaningful text
    const errorNodes = parent.querySelectorAll('li, div, span');

    const visibleErrors = Array.from(errorNodes)
      .filter(el => {
        const style = window.getComputedStyle(el);
        const text = el.innerText?.trim();
        return (
          text &&
          text.length < 200 &&
          style.display !== 'none' &&
          style.visibility !== 'hidden' &&
          (style.color.includes('rgb(255') || style.color.includes('red')) // red
        );
      })
      .map(el => el.innerText.trim());

    if (visibleErrors.length) {
      return visibleErrors.join('. ');
    }
  }

  // ✅ 3. Fallback to required attr
  if (field.required && !field.value) {
    return `Please fill out the ${field.name || field.id || 'field'}`;
  }

  return "";
}


